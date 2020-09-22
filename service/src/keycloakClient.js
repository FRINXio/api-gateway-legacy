import kClient from "@fbc-hub/keycloak-client";

const RETRY_TIME = 5 * 1000; // 5 seconds
let initialized = false;

// repeatedly try to init the client
async function tryStart() {
  console.log(`Initializing keycloak at ${process.env.KEYCLOAK_HOST}`);
  kClient
    .init()
    .then(() => {
      console.log("Keycloak client ready");
      initialized = true;
      // good
    })
    .catch((err) => {
      // important because when starting all the containers,
      // keycloak isn't immediately available
      console.log("Couldn't initialize keycloak client, trying again in 5 sec.");
      console.log(err);
      setTimeout(tryStart, RETRY_TIME);
    });
}

tryStart();

export async function groupsForUser(
  tenant,
  user,
  sessionId
) {
  if (!initialized) {
    throw new Error("Keycloak client not yet initialized");
  }

  let groups = await kClient.getGroupsForUser(user, tenant);
  if (!groups) {
    throw new Error("Unable to load user groups");
  }

  // TODO cache roles per session ID ?
  return groups.map((x) => x.name);
}

export async function rolesForUser(
  tenant,
  user,
  sessionId
) {
  if (!initialized) {
   throw new Error("Keycloak client not yet initialized");
  }

  let roles = await kClient.getRolesForUser(user, tenant);
  if (!roles) {
    throw new Error("Unable to load user roles");
  }

  // TODO cache roles per session ID ?
  return roles.map((x) => x.name);
}
