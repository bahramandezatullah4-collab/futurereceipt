import { Router, type IRouter } from "express";
import healthRouter from "./health";
import ecobillRouter from "./ecobill";
import betaRouter from "./beta";

const router: IRouter = Router();

router.use(healthRouter);
router.use(ecobillRouter);
router.use(betaRouter);

export default router;
