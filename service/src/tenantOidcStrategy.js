import { Strategy } from "passport-strategy";
import makeOidcStrategy from "./oidcStrategy";
import config from "./config";

export default class TenantOidcStrategy extends Strategy {
  _strategies = {};

  constructor() {
    super();
  }

  async _getStrategy(tenant) {
    if (!tenant) {
      return null;
    }
    let strategy = this._strategies[tenant];
    if (!strategy) {
      strategy = this._strategies[tenant] = await makeOidcStrategy(tenant);
    }
    strategy.error = this.error;
    strategy.redirect = this.redirect;
    strategy.success = this.success;
    strategy.fail = this.fail;
    strategy.pass = this.pass;
    return strategy;
  }

  authenticate(req, options) {
    (async () => {
      const strategy = await this._getStrategy(req.tenant);
      strategy.authenticate(req, options);
    })().catch((_error) => {
      this.error();
    });
  }
}
