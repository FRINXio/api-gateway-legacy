import kClient from "@fbc-hub/keycloak-client";
import dotenv from "dotenv";
dotenv.config();

const TENANT_POLL_INTERVAL = 15 * 1000; // 15 seconds
const RETRY_TIME = 5 * 1000; // 5 seconds

const env = process.env;
const conf = {
  keycloakHost: env.KEYCLOAK_HOST ?? "keycloak:8080",
  keycloakFrontendUrl:
    env.KEYCLOAK_FRONTEND_URL ?? "http://auth.localtest.me:8080/auth",
  apiGatewayHost: env.API_GATEWAY_HOST ?? "localtest.me:5000",
  workflowFrontendHost: env.WORKFLOW_FRONTEND_HOST ?? "workflow-frontend:5000",
  resourcemanagerFrontendHost:
    env.RESOURCE_MANAGER_FRONTEND_HOST ?? "resource-manager-frontend:5000",
  workflowProxyHost: env.WORKFLOW_PROXY_HOST ?? "workflow-proxy:8088",
  kibanaHost: env.KIBANA_HOST ?? "kibana:5601",
  docusaurusHost: env.DOCUSAURUS_HOST ?? "docs-docusaurus:3000",
  voyagerHost: env.VOYAGER_HOST ?? "docs-voyager:8080",
  sessionSecret: env.SESSION_SECRET ?? "example of a secret",
  resourceManagerHost: env.RESOURCE_MANAGER_HOST ?? "resource-manager:8884",
  tenantClients: {},
  clientId: "api-gateway",
};
console.log('Starting with configuration', {conf});

async function pollKeycloak() {
  const cli = kClient.raw;
  // fetch all realms
  const realms = await cli.realms.find();
  // for all realms
  for (const r of realms) {
    // skip the "master" realm
    if (r.realm == "master") continue;
    // get all clients for this realm
    const clients = await cli.clients.find({ realm: r.realm});
    // find the "api-gateway" client
    const c = clients.find(x => x.clientId == "api-gateway");
    // report an error if a realm is missing the client
    if (!c) {
      console.error(
        `Found non-master realm ${r.realm} without an "api-gateway" client.`
      );
      continue;
    }
    // get the secret of the api-gateway client
    let secret = await cli.clients.getClientSecret({ id: c.id, realm: r.realm});
    secret = secret.value;
    // override the value currently in the store
    if (r.realm in conf.tenantClients) {
      if (conf.tenantClients[r.realm].clientSecret != secret){
        console.log(`Client secret for realm ${r.realm} has changed.`);
        conf.tenantClients[r.realm].clientSecret = secret;
      }
    }
    // no value in the store, add it anew
    else {
      console.log(`Onboarded new realm ${r.realm}.`);
      conf.tenantClients[r.realm] = { clientSecret: secret };
    }
  }
}

async function tryStart() {
  kClient
    .init()
    .then(() => {
      pollKeycloak();
      setInterval(pollKeycloak, TENANT_POLL_INTERVAL);
    })
    .catch((err) => {
      // important because when starting all the containers,
      // keycloak isn't immediately available
      console.log("Couldn't initilize keycloak client, trying again in a few seconds.");
      setTimeout(tryStart, RETRY_TIME);
    });
}
tryStart();

export default conf;
