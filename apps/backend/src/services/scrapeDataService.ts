const cheerio = require("cheerio");
import pLimit from "p-limit";
import { chunk } from "lodash";
import { setTimeout } from "timers/promises";

import * as c from "../cars";

export default class ScrapingDataService {
  private BASEPATH = "https://www.auto-data.net";
  private CONCURRENCY_LIMIT = 3;
  private BATCH_DELAY = 5000; // 5 detik antar chunk
  private BATCH_SIZE = 10;

  // Async which scrapes the data
  public async start(): Promise<c.ScrapeLog> {
    // Fetch HTML of the page we want to scrape

    try {
      const result = await this._scrapeAllCars();

      // // Write c ountries array in cars.json file
      const writeBrandFile = await Bun.write(
        "brands.json",
        JSON.stringify(result.brands, null, 2)
      );

      const writeCarsFile = await Bun.write(
        "cars.json",
        JSON.stringify(result.resource, null, 2)
      );

      if (!writeCarsFile || !writeBrandFile) {
        result.message = "Failed to written data to file";
      }

      result.message = "Successfully written data to file";
      return result;
    } catch (err: any) {
      console.log(`Failed to written data to file. Throw error : ${err}`);
      throw err;
    }
  }

  private async _fetchData(url: string, element: string): Promise<any> {
    const timeout = 10000; // Timeout in milliseconds
    const controller = new AbortController();
    const signal = controller.signal;

    const response = await fetch(url, { signal });

    const data = await response.text();
    const $ = cheerio.load(data);

    setTimeout(timeout, () => {
      controller.abort();
    });

    return $(element);
  }

  // Helper: konversi teks menjadi camelCase key
  private _toCamelCaseKey(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .split(" ")
      .filter((w) => /^[a-zA-Z]+$/.test(w))
      .map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
      .join("");
  }

  private async _scrapeAllBrands(): Promise<c.Vehicle[]> {
    const $carBrandItems = await this._fetchData(
      `${this.BASEPATH}/en`,
      ".markite > a.marki_blok"
    );

    return $carBrandItems.toArray().map((brand: any) => {
      const $brand = cheerio.load(brand);

      const brandLink = $brand("a.marki_blok").attr("href");
      const brandImgSrc = $brand("img").attr("src");

      return {
        brand: {
          title: $brand("strong").text(),
          img: this.BASEPATH + brandImgSrc,
          link: this.BASEPATH + brandLink,
        },
        models: [],
      };
    });
  }

  // Scrape seluruh model dari satu brand
  private async _scrapeCarModels(brandLink: string): Promise<c.CarModel[]> {
    // Loop through each car model and fetch data

    const $carModelItems = await this._fetchData(
      brandLink,
      "ul.modelite > li.letter"
    );

    return $carModelItems.toArray().map((model: any) => {
      const $model = cheerio.load(model);
      return {
        title: $model("ul li a > strong").text(),
        img: this.BASEPATH + $model("ul li a > img").attr("src"),
        link: this.BASEPATH + $model("ul li a").attr("href"),
        gen: [],
      };
    });
  }

  // Scrape seluruh generasi dari satu model
  private async _scrapeCarGens(modelLink: string): Promise<c.CarGen[]> {
    // Loop through each car generation

    const $carGenItems = await this._fetchData(
      modelLink,
      "table.generr > tbody > tr.f"
    );

    return $carGenItems.toArray().map((gen: any) => {
      const $gen = cheerio.load(gen);

      const gens = {
        img: this.BASEPATH + $gen("th.i > a > img").attr("src"),
        link: this.BASEPATH + $gen("th.i > a").attr("href"),
        title: $gen("th.i > a > strong").text(),
        year: $gen("td.i > a > .end, .cur").text(),
        type: $gen("td.i > a > strong.chas").text(),
        power: $gen("td.i > a > span:first").text(),
        demensions: $gen("td.i > a > span:last").text(),
        cars: [],
      };
      // console.dir(gens);
      return gens;
    });
  }

  // Loop through each car generation and fetch data

  // Scrape mobil dari satu generasi
  private async _scrapeCarsFromGen(genLink: string): Promise<c.CarSpec[]> {
    const $carItems = await this._fetchData(
      genLink,
      "table.carlist > tbody > tr.i"
    );
    const cars: c.CarSpec[] = await Promise.all<c.CarSpec>(
      $carItems.toArray().map(async (car: any) => {
        const $carEl = cheerio.load(car);
        const carItemLink: string = $carEl("th.i a").attr("href");
        if (!carItemLink) return null;

        const carSpecList = await this._scrapeCarSpec(carItemLink);
        return carSpecList;
      })
    );
    // console.dir(cars[0].attrs);
    return cars.filter(Boolean) as c.CarSpec[];
  }

  // Scrape detail spesifikasi mobil
  private async _scrapeCarSpec(link: string): Promise<c.CarSpec> {
    const $carSpecDetails = await this._fetchData(this.BASEPATH + link, "body");
    const photos: string[] = [];
    const title = $carSpecDetails.find("h1").text();
    const imgMain = $carSpecDetails.find("img.inspecs").attr("src");
    if (imgMain) photos.push(this.BASEPATH + imgMain);

    $carSpecDetails
      .find(".imagescar > img")
      .toArray()
      .forEach((img: any) => {
        const src = $carSpecDetails.find(img).attr("src");
        if (src) photos.push(this.BASEPATH + src);
      });

    const attrs: Record<string, Record<string, any>> = {};
    let currentSection = "";

    $carSpecDetails
      .find("table.cardetailsout > tbody > tr")
      .toArray()
      .forEach((row: any) => {
        const $row = cheerio.load(row);
        const newSection = $row("tr.no th.no strong.car").attr("id");
        if (newSection) {
          currentSection = newSection;
          attrs[currentSection] = {};
          return;
        }

        const th = $row("tr").not(".no").find("th").text();
        const td = $row("tr")
          .not(".no")
          .find("td")
          .contents()
          .not("span")
          .text()
          .trim();
        const thKey = this._toCamelCaseKey(th);

        if (thKey && td && currentSection) {
          attrs[currentSection][thKey] = td;
        }
      });

    return { title, photos, attrs };
  }

  // Main scraping
  // private async _scrapeAllCars(): Promise<c.Vehicle[]> {
  //   const cars = await this._scrapeAllBrands();

  //   const enrichedCars = await Promise.all(
  //     cars.map(async (car) => {
  //       const models = await this._scrapeCarModels(car.brand.link);

  //       const modelsWithGen = await Promise.all(
  //         models.map(async (model) => {
  //           const gens = await this._scrapeCarGens(model.link);

  //           const gensWithCars = await Promise.all(
  //             gens.map(async (gen) => {
  //               const carsFromGen = await this._scrapeCarsFromGen(gen.link);
  //               return { ...gen, cars: carsFromGen };
  //             })
  //           );

  //           return { ...model, gen: gensWithCars };
  //         })
  //       );

  //       return { ...car, models: modelsWithGen };
  //     })
  //   );

  //   return enrichedCars;
  // }

  private async _scrapeAllCars(): Promise<c.ScrapeLog> {
    const limit = pLimit(this.CONCURRENCY_LIMIT); // Maksimum 3 request berjalan bersamaan
    let amountData: {
      brands: number;
      models: number;
      gen: number;
      cars: number;
    } = {
      brands: 0,
      models: 0,
      gen: 0,
      cars: 0,
    };
    const brandData: c.CarBrand[] = [];

    const cars = await this._scrapeAllBrands();
    const carChunks = chunk(cars, this.BATCH_SIZE);

    amountData.brands = cars.length;

    const result: c.Vehicle[] = [];

    for (const chunk of carChunks) {
      const chunkResult = await Promise.all(
        chunk.map((car: c.Vehicle) => {
          brandData.push(car.brand);

          return limit(async () => {
            const models = await this._scrapeCarModels(car.brand.link);
            amountData.models = models.length;
            await setTimeout(1000);

            const modelsWithGen = await Promise.all(
              models.map(async (model: c.CarModel) => {
                const gens = await this._scrapeCarGens(model.link);
                amountData.gen = gens.length;
                await setTimeout(1000);

                const gensWithCars = await Promise.all(
                  gens.map(async (gen: c.CarGen) => {
                    const carsFromGen = await this._scrapeCarsFromGen(gen.link);
                    amountData.cars = carsFromGen.length;
                    await setTimeout(500);

                    return { ...gen, cars: carsFromGen };
                  })
                );

                return { ...model, gen: gensWithCars };
              })
            );
            return { ...car, models: modelsWithGen };
          });
        })
      );
      result.push(...chunkResult);

      // Delay antar chunk agar tidak overload ke server target
      await setTimeout(this.BATCH_DELAY);
    }

    return { brands: brandData, resource: result, amountData };

    // return enrichedCars;
  }

  // private async _scrapeAllCars(): Promise<c.Vehicle[]> {
  //   const cars = await this._scrapeAllBrands();
  //   const limit = pLimit(3); // Maksimum 3 request berjalan bersamaan

  //   const carChunks = this.chunkArray(cars, 5); // 5 mobil sekaligus

  //   const result: c.Vehicle[] = [];

  //   for (const chunk of carChunks) {
  //     const chunkResult = await Promise.all(
  //       chunk.map((car: c.Vehicle) =>
  //         limit(async () => {
  //           car.models = await this._scrapeCarModels(car.brand.link);

  //           for (const model of car.models) {
  //             await setTimeout(500); // Delay kecil antar model untuk amankan scrape
  //             model.gen = await this._scrapeCarGens(model.link);

  //             for (const gen of model.gen) {
  //               await setTimeout(300); // Delay antar gen untuk hindari blocking
  //               gen.cars = await this._scrapeCarsFromGen(gen.link);
  //             }
  //           }

  //           return car;
  //         })
  //       )
  //     );

  //     result.push(...chunkResult);

  //     // Delay antar chunk agar tidak overload ke server target
  //     await setTimeout(1000);
  //   }

  //   return result;
  // }
}
