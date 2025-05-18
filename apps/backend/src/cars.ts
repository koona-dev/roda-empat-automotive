// URL of the page we want to scrape

type Vehicle = {
  brand: CarBrand;
  models: CarModel[];
};

type CarBrand = { title: string; logo: string; link: string };

type CarModel = { title: string; img: string; link: string; gen: CarGen[] };

type CarGen = {
  title: string;
  img: string;
  link: string;
  year: string;
  type: string;
  power: string;
  demensions: string;
  cars: CarSpec[];
};

type CarSpec = {
  title: string;
  photos: string[];
  attrs: Record<string, Record<string, any>>;
};

// type CarSpec = {
//   name: string;
//   imgList: string[];
//   generalInfo: GeneralInfo;
//   performance: Performance;
//   engineSpecs: EngineSpecs;
//   electricSpecs?: ElectricSpecs | undefined;
//   internalCombustionSpecs?: InternalCombustionSpecs | undefined;
//   spaceVolWeight: SpaceVolWeight;
//   dimensions: Dimensions;
//   drivetrainBrakesSuspension: DrivetrainBrakesSuspension;
// };

type GeneralInfo = {
  caption: string;
  brand: string;
  model: string;
  gen: string;
  engine: string;
  power: string;
  bodyType: string;
  seats: number;
  doors: number;
};

type Performance = {
  caption: string;
  fuelUrban: string;
  fuelExtraUrban: string;
  fuelCombined: string;
  fuelType: string;
  acceleration: string;
  maxSpeed: string;
  weightPower: string;
  weightTorque: string;
};

type EngineSpecs = {
  caption: string;
  power: string;
  powerPerLiter: string;
  Torque: string;
  engineLayout: string;
  engineModel: string;
  engineDisplacement: string;
  numberCylinders: number;
  engineConfig: string;
  cylinderBore: string;
  pistonStroke: string;
  valvesPerCylinder: number;
  FuelInjectionSystem: string;
  engineAspiration: string;
  engineOilCapacity: string;
  coolant: string;
  engineSystems: string;
};

type ElectricSpecs = {
  caption: string;
  grossBatery: string;
  batteryVoltage: string;
  baterryTech: string;
  batteryLoc: string;
  electricMotor: string;
  electricMotorTorque: string;
  electricMotorLoc: string;
  systemPower: string;
  systemTorque: string;
};

type InternalCombustionSpecs = {
  caption: string;
  power: string;
  powerPerLiter: string;
  engineLayout: string;
  engineModel: string;
  engineDisplacement: string;
  numberCylinders: number;
  engineConfig: string;
  cylinderBore: string;
  pistonStroke: string;
  compressRatio: string;
  valvesPerCylinder: number;
  FuelInjectionSystem: string;
  engineAspiration: string;
  valvetrain: string;
  engineSystems: string;
};

type SpaceVolWeight = {
  caption: string;
  kerbWeight: string;
  maxWeight: string;
  maxLoad: string;
  minTrunk: string;
  maxTrunk: string;
  fuelTank: string;
};

type Dimensions = {
  caption: string;
  length: string;
  width: string;
  widthMirrors: string;
  height: string;
  wheelbase: string;
  frontTrack: string;
  rearTrack: string;
  rideHeight: string;
  minTurningCirlce: string;
};

type DrivetrainBrakesSuspension = {
  caption: string;
  drivetrain: string;
  driveWheel: string;
  numberAndtypeGears: string;
  frontSuspension: string;
  rearSuspension: string;
  frontBrakes: string;
  rearBrakes: string;
  assistingSystems: string;
  steerngType: string;
  powerSteering: string;
  tiresSize: string;
  wheelRimsSize: string;
};

type ScrapeLog = {
  brands: CarBrand[];
  resource: Vehicle[];
  amountData: {
    brands: number;
    models: number;
    gen: number;
    cars: number;
  };
  message?: string;
};

export type {
  Vehicle,
  CarBrand,
  CarModel,
  CarGen,
  CarSpec,
  GeneralInfo,
  Performance,
  EngineSpecs,
  ElectricSpecs,
  InternalCombustionSpecs,
  SpaceVolWeight,
  Dimensions,
  DrivetrainBrakesSuspension,
  ScrapeLog,
};
