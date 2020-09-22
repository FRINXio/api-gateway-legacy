// doesn't handle tenant in request header, only in URL
// returns type ?String
function getTenantFromReq(req) {
  if (req.hostname.indexOf(".") === -1) {
    return null;
  } else {
    return req.hostname.split(".")[0];
  }
}

function isValidTenant(tenant) {
  return true;
}

const tenantMiddleware = (req, res, next) => {
  const tenant = getTenantFromReq(req);
  if (isValidTenant(tenant)) {
    req.tenant = tenant;
  } else {
    req.tenant = null;
  }
  next();
};

export default tenantMiddleware;
