import createSessionService from "./sessionServices/create.session";
import getSessionService from "./sessionServices/get.session";
import turnSessionService from "./sessionServices/turn.session";

export default {
    ...createSessionService,
    ...getSessionService,
    ...turnSessionService
};
