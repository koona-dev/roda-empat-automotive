import { Hono } from "hono";

const carRoutes = new Hono().get("/cars", async (c) => {
  return c.text("COMMMING SOOOON!!!");
});

export default carRoutes;
export type CarsType = typeof carRoutes;
