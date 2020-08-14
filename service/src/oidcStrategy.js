import { Strategy as OidcStrategy, Issuer } from "openid-client";
import config from "./config";

export default async function makeOidcStrategy(tenant) {
  const keycloakConfigUrl = `http://${config.keycloakHost}/auth/realms/${tenant}/.well-known/openid-configuration`;
  const issuer = await Issuer.discover(keycloakConfigUrl);

  const client = new issuer.Client({
    client_id: config.clientId,
    client_secret: config.tenantClients[tenant].clientSecret,
    response_types: ["code"],
  });

  const options = {
    client: client,
    passReqToCallback: true,
    params: {
      redirect_uri: `http://${tenant}.${config.apiGatewayHost}/login/oidc/callback`,
    },
  };

  const verify = (req, tokenSet, userInfo, done) => {
    const tenant = req.tenant;
    const username = userInfo["preferred_username"];
    req.session.oidc = {
      tokenSet,
    };
    // TODO: handle errors in this function w/ try-catch
    done(undefined, { tenant, username });
  };

  return new OidcStrategy(options, verify);
}
