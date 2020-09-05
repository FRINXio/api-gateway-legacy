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

function ensureLoggedIn (req, res, next) {
  if (req.isAuthenticated()) {
    next();
  } else {
    res.redirect("/login/oidc");
  }
}

function formatRequestAuthHeaders(req, res, next) {
  req.set("From", req.user.username);
  req.set("x-tenant-id", req.user.tenant);
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
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      proxyReqOpts.headers["From"] = srcReq.user.username;
      proxyReqOpts.headers["x-tenant-id"] = srcReq.user.tenant;
      //resource-manager needs a role but does not use or evaluate it 
      //thus we provide a dummy value ("NONE") for resource-manager API checks
      proxyReqOpts.headers["x-auth-user-role"] = 'NONE';
      return proxyReqOpts;
    },
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
      proxyReqOpts.headers["From"] = srcReq.user.username;
      proxyReqOpts.headers["x-tenant-id"] = srcReq.user.tenant;
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
      proxyReqOpts.headers["From"] = srcReq.user.username;
      proxyReqOpts.headers["x-tenant-id"] = srcReq.user.tenant;
      return proxyReqOpts;
    },
  })
);

app.all(
  "/workflow/proxy/*",
  ensureLoggedIn,
  proxy(`http://${config.workflowProxyHost}`, {
    proxyReqPathResolver: (req) => {
      // remove prefix
      const path = req.url.substr('/workflow/proxy'.length)
      return path;
    },
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      proxyReqOpts.headers["From"] = srcReq.user.username;
      proxyReqOpts.headers["x-tenant-id"] = srcReq.user.tenant;
      return proxyReqOpts;
    },
  })
);

// TODO if all of these pieces of code will be the same could we move these
// to a json file and have them loaded from that?
app.all(
  "/kibana*",
  ensureLoggedIn,
  proxy(`http://${config.kibanaHost}`, {
    proxyReqPathResolver: (req) => {
      // remove prefix
      const path = req.url.substr('/kibana'.length)
      return path;
    },
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      proxyReqOpts.headers["From"] = srcReq.user.username;
      proxyReqOpts.headers["x-tenant-id"] = srcReq.user.tenant;
      return proxyReqOpts;
    },
  })
);

// liveness and readiness probes
app.get("/probe/liveness", (req, res) => res.sendStatus(200));
app.get("/probe/readiness", (req, res) => res.sendStatus(200));

app.listen(port, () => console.log(`Listening at http://localhost:${port}`));
