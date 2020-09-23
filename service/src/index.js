/*
  Work in progress.
  This is a basic API Gateway similar to Symphony's platform-server.
  It is a WIP and doesn't yet include all of the awesome middleware they had.
  No CSRF protection or helmet or anything of the sort quite yet.
  Also needs strict flow typing and eslint and prettier and whatnot.
*/

import express from "express";
import passport from "passport";
import session from "express-session";
import tenantMiddleware from "./tenantMiddleware";
import TenantOidcStrategy from "./tenantOidcStrategy";
import config from "./config";
import proxy from "express-http-proxy"
import {groupsForUser, rolesForUser} from "./keycloakClient";

const app = express();
const port = 5000;

app.use(
  session({
    resave: false,
    saveUninitialized: true,
    secret: config.sessionSecret,
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(tenantMiddleware);
passport.use("oidc", new TenantOidcStrategy());
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// TODO: redirect successful login to whatever page the user was trying to view

function ensureLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    next();
  } else {
    res.redirect("/login/oidc");
  }
}

const userIdHeaderKey = "From";
const tenantIdHeaderKey = "x-tenant-id";
const userRolesHeaderKey = "x-auth-user-roles";
const userGroupsHeaderKey = "x-auth-user-groups";

function attachBaseIdentity(proxyReqOpts, srcReq) {
  proxyReqOpts.headers[userIdHeaderKey] = srcReq.user.username;
  proxyReqOpts.headers[tenantIdHeaderKey] = srcReq.user.tenant;
}

async function attachBaseIdentityAsync(proxyReqOpts, srcReq) {
  try {
    attachBaseIdentity(proxyReqOpts, srcReq);
  } catch (e) {
    console.log("Unable to load user or tenant id", e);
    throw e;
  }
}

async function attachExtendedIdentity(proxyReqOpts, srcReq) {
  try {
    let rolesGroups = await Promise.all([
      rolesForUser(srcReq.user.tenant, srcReq.user.username),
      groupsForUser(srcReq.user.tenant, srcReq.user.username),
    ]);
    proxyReqOpts.headers[userRolesHeaderKey] = rolesGroups[0];
    proxyReqOpts.headers[userGroupsHeaderKey] = rolesGroups[1];
  } catch (e) {
    console.log("Unable to load roles and groups for user", e);
    throw e;
  }
}

// Promise based http proxy decorator that attaches extended identity info to the request (including groups/roles)
async function extendedIdentityProxyDecorator(proxyReqOpts, srcReq) {
  await Promise.all([
    attachBaseIdentityAsync(proxyReqOpts, srcReq),
    attachExtendedIdentity(proxyReqOpts, srcReq),
  ]);
  return proxyReqOpts
}

function formatRequestAuthHeaders(req, res, next) {
  req.set(userIdHeaderKey, req.user.username);
  req.set(tenantIdHeaderKey, req.user.tenant);
  next();
}

app.get(
  "/login/oidc",
  passport.authenticate("oidc", {
    failureRedirect: "/login/failed",
  })
);

app.get("/login/success", (req, res) => {
  res.redirect("/");
});

app.get("/login/failed", (req, res) => {
  res.send("Login failed.");
});

app.get("/login/oidc/callback", (req, res, next) => {
  passport.authenticate("oidc", {
    successRedirect: "/login/success",
    failureRedirect: "/login/failed",
  })(req, res, next);
})

app.get("/", ensureLoggedIn, (req, res) => {
  res.send(`SUCCESS. User: ${JSON.stringify(req.user)}`);
});


app.get("/wf", (req, res) => res.redirect("/workflow/frontend/"));

app.all(
  "/resourcemanager/graphql*",
  ensureLoggedIn,
  proxy(`http://${config.resourceManagerHost}`, {
    proxyReqPathResolver: (req) => {
      return '/query';
    },
    proxyReqOptDecorator: extendedIdentityProxyDecorator
  })
);

app.all(
  "/workflow/frontend*",
  ensureLoggedIn,
  proxy(`http://${config.workflowFrontendHost}`, {
    proxyReqPathResolver: (req) => {
      return req.url;
    },
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      attachBaseIdentity(proxyReqOpts, srcReq);
      return proxyReqOpts;
    },
  })
);

app.all(
  "/resourcemanager/frontend*",
  ensureLoggedIn,
  proxy(`http://${config.resourcemanagerFrontendHost}`, {
    proxyReqPathResolver: (req) => {
      return req.url;
    },
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      attachBaseIdentity(proxyReqOpts, srcReq);
      return proxyReqOpts;
    },
  })
);

// TODO if all of these pieces of code will be the same could we move these
// to a json file and have them loaded from that?
var services = {
  "kibana": config.kibanaHost,
  "docusaurus": config.docusaurusHost,
  "voyager": config.voyagerHost
};

for (let [service, url] of Object.entries(services)) {
  app.all(
    "/" + service + "*",
    ensureLoggedIn,
    proxy("http://" + url, {
      proxyReqPathResolver: (req) => {
        // remove prefix
        const path = req.url.substr(('/' + service).length);
        return path;
      },
      proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
        attachBaseIdentity(proxyReqOpts, srcReq);
        return proxyReqOpts;
      },
    })
  );
}

var servicesWithExtendedIdentity = {
  "workflow/proxy": config.workflowProxyHost,
};

for (let [service, url] of Object.entries(servicesWithExtendedIdentity)) {
  app.all(
    "/" + service + "*",
    ensureLoggedIn,
    proxy("http://" + url, {
      proxyReqPathResolver: (req) => {
        // remove prefix
        const path = req.url.substr(('/' + service).length);
        return path;
      },
      proxyReqOptDecorator: extendedIdentityProxyDecorator,
    })
  );
}

// liveness and readiness probes
app.get("/probe/liveness", (req, res) => res.sendStatus(200));
app.get("/probe/readiness", (req, res) => res.sendStatus(200));

app.get("/routes", (req, res) => {
  let get = app._router.stack.filter(
    r => r.route && r.route.methods.get).map(r => r.route.path);
  let post = app._router.stack.filter(
    r => r.route && r.route.methods.post).map(r => r.route.path);
  res.send({get: get, post: post});
});

app.listen(port, () => console.log(`Listening at http://localhost:${port}`));
