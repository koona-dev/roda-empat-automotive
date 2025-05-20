/**
 * DECLARE PACKAGES
 **/
const cheerio = require("cheerio");
import pLimit from "p-limit";
import { chunk } from "lodash";

// MODELS
import * as c from "./cars";

/**
 * SCRRAPING SERVICE
 **/
export default class ScrapingDataService {
  private BASEPATH = "https://www.auto-data.net";
  private CONCURRENCY_LIMIT = 3;
  private BATCH_DELAY = 10000; // 5 detik antar chunk
  private BATCH_SIZE = 10; //chunk batch

  /**
   * Start to scrape data and generate file json
   **/
  public async start(): Promise<c.ScrapeLog> {
    try {
      const result = await this._scrapeAllCars();

      // Write brands array in brands.json file
      const writeBrandFile = await Bun.write(
        "brands.json",
        JSON.stringify(result.brands, null, 2)
      );

      // Write cars array in cars.json file
      const writeCarsFile = await Bun.write(
        "cars.json",
        JSON.stringify(result.resource, null, 2)
      );

      // check if write json file is successfully
      if (!writeCarsFile || !writeBrandFile) {
        result.message = "Failed to written data to file";
      }

      result.message = "Successfully written data to file";
      return result;
    } catch (err: any) {
      // throw error when failed to scraping data
      console.log(`Failed to written data to file. Throw error : ${err}`);
      throw err;
    }
  }

  /**
   * Fetch and handle url data from web
   **/
  private async _fetchData(url: string, element: string): Promise<any> {
    const timeout = 10000; // Timeout in milliseconds
    const controller = new AbortController();
    const signal = controller.signal;

    const response = await fetch(url, { signal });

    const data = await response.text();
    const $ = cheerio.load(data);

    Bun.sleep(timeout).then(() => {
      controller.abort();
    });

    return $(element);
  }

  /**
   * generate field string car spec to camelCase to be used as key in json
   **/
  private _toCamelCaseKey(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .split(" ")
      .filter((w) => /^[a-zA-Z]+$/.test(w))
      .map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
      .join("");
  }

  /**
   * Method for scraping all brands section in website
   **/
  private async _scrapeAllBrands(): Promise<c.Vehicle[]> {
    // fetch url and element in brands page
    const $carBrandItems = await this._fetchData(
      `${this.BASEPATH}/en/allbrands`,
      ".brands > a.marki_blok"
    );

    // Loop brand list from element anchor
    return $carBrandItems.toArray().map((brand: any) => {
      const $brand = cheerio.load(brand);

      const brandLink = $brand("a.marki_blok").attr("href");
      const brandImgSrc = $brand("img").attr("src");

      // Insert all props to models
      return {
        brand: {
          title: $brand("strong").text(),
          logo: this.BASEPATH + brandImgSrc,
          link: this.BASEPATH + brandLink,
        },
        models: [],
      };
    });
  }

  /**
   * Scrape all models every brands
   **/
  private async _scrapeCarModels(brandLink: string): Promise<c.CarModel[]> {
    // Fetch all model data based on link and selected element
    const $carModelItems = await this._fetchData(
      brandLink,
      "ul.modelite > li.letter"
    );

    // Loop through each car model and fetch data
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

  /**
   * Scrape all generation every models car
   **/
  private async _scrapeCarGens(modelLink: string): Promise<c.CarGen[]> {
    // Fetch all genwith model link and trigger element
    const $carGenItems = await this._fetchData(
      modelLink,
      "table.generr > tbody > tr.f"
    );

    // Loop through each car generation
    return $carGenItems.toArray().map((gen: any) => {
      const $gen = cheerio.load(gen);

      // Insert all props in element to models return to array
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

  /**
   * Scrape all Cars every Generation
   **/
  private async _scrapeCarsFromGen(genLink: string): Promise<c.CarSpec[]> {
    // Fetch all data generation in element with link and selected element
    const $carItems = await this._fetchData(
      genLink,
      "table.carlist > tbody > tr.i"
    );

    /**
     *  This process must use p-limit,
     * chunk, and delay to avoid
     * server crash cause overload
     **/
    const cars: c.CarSpec[] = await Promise.all<c.CarSpec>(
      // Loop through each car generation and fetch data
      $carItems.toArray().map(async (car: any) => {
        const $carEl = cheerio.load(car);
        const carItemLink: string = $carEl("th.i a").attr("href");

        if (!carItemLink) return null;
        // After looping cars in gen details, so we gonna direct link into car specs details
        const carSpecList = await this._scrapeCarSpec(carItemLink);
        return carSpecList;
      })
    );

    return cars.filter(Boolean) as c.CarSpec[];
  }

  /**
   * Scrape all car specification on car details
   **/
  private async _scrapeCarSpec(link: string): Promise<c.CarSpec> {
    // DECLARE ALL PROPS ELEMENT
    const $carSpecDetails = await this._fetchData(this.BASEPATH + link, "body");
    const photos: string[] = [];
    const title = $carSpecDetails.find("h1").text();
    const imgMain = $carSpecDetails.find("img.inspecs").attr("src");
    if (imgMain) photos.push(this.BASEPATH + imgMain);

    // Loop image gallery
    $carSpecDetails
      .find(".imagescar > img")
      .toArray()
      .forEach((img: any) => {
        const src = $carSpecDetails.find(img).attr("src");
        if (src) photos.push(this.BASEPATH + src);
      });

    const attrs: Record<string, Record<string, any>> = {};
    let currentSection = "";

    // Loop specification field
    $carSpecDetails
      .find("table.cardetailsout > tbody > tr")
      .toArray()
      .forEach((row: any) => {
        // Get all header every specification
        const $row = cheerio.load(row);
        const newSection = $row("tr.no th.no strong.car").attr("id");
        if (newSection) {
          currentSection = newSection;
          attrs[currentSection] = {};
          return;
        }
        // Get all key field specification
        const th = $row("tr").not(".no").find("th").text();

        // Get all value field specification
        const td = $row("tr")
          .not(".no")
          .find("td")
          .contents()
          .not("span")
          .text()
          .trim();
        const thKey = this._toCamelCaseKey(th);

        // Insert evrey field into object models
        if (thKey && td && currentSection) {
          attrs[currentSection][thKey] = td;
        }
      });

    return { title, photos, attrs };
  }

  /**
   * Scrape all flow process every section data
   **/
  private async _scrapeAllCars(): Promise<c.ScrapeLog> {
    // Set limit concurency when transfer data
    const limit = pLimit(this.CONCURRENCY_LIMIT); // Maksimum 3 request berjalan bersamaan

    // DECLARE ALL COMPONENTS
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

    // Set chunk for grouping flow into batch
    const carChunks = chunk(cars, this.BATCH_SIZE);
    // Get brands data length
    amountData.brands = cars.length;

    const result: c.Vehicle[] = [];

    // Loop every batch chunk
    for (const chunk of carChunks) {
      // Fetch all promise data
      const chunkResult = await Promise.all(
        // Loop list cars
        chunk.map((car: c.Vehicle) => {
          // Give limit every process as much as 3 process
          return limit(async () => {
            // Fetch model list
            const models = await this._scrapeCarModels(car.brand.link);
            brandData.push(car.brand);
            // Get models amount
            amountData.models += models.length;

            await Bun.sleep(8000);

            // Fetch generation list
            const modelsWithGen = await Promise.all(
              models.map(async (model: c.CarModel) => {
                const gens = await this._scrapeCarGens(model.link);
                amountData.gen += gens.length;

                await Bun.sleep(6000);

                // Fetch cars list
                const gensWithCars = await Promise.all(
                  gens.map(async (gen: c.CarGen) => {
                    const carsFromGen = await this._scrapeCarsFromGen(gen.link);
                    amountData.cars += carsFromGen.length;

                    await Bun.sleep(4000);

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
      await Bun.sleep(this.BATCH_DELAY);
    }

    return { brands: brandData, resource: result, amountData };
  }
}
