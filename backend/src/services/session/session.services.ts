import createSessionService from "./sessionServices/create.session";
import getSessionService from "./sessionServices/get.session";
import evaluateSessionService from "./sessionServices/evaluate.session";

export default {
    ...createSessionService,
    ...getSessionService,
    ...evaluateSessionService
};
