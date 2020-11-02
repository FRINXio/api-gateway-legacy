## Create a Tenant

* Log into the master realm on keycloak `http://auth.localtest.me:8080/`.
* Add realm. Enter some name (note that a "realm" is a tenant in Keycloak terminology - this will be the tenant name).
* Go to the `Clients` page. Create client named `api-gateway`.
* Set `Access Type` to `confidential`.
* Give it a valid redirect url `http://TENANT_NAME.localtest.me:5000/*`.
* Save

## Create a User

* Go the the `Users` page.
* Add User.
* Give the user a Username.
* Go to their `Credentials` tab.
* Give them a password, set `Temporary` to `off`.

## Log In

* Go to http://TENANT_NAME.localtest.me:5000/

## Developing with Helm and Kubernetes

Build and push the docker image:
```
cd integration

docker-compose build api_gateway

docker tag integration_api_gateway your_docker_url/api_gateway

docker push your_docker_url/api_gateway
```

Create kubernetes secret with docker repo creds:
```
kubectl create secret docker-registry artifactory --docker-server=your_docker_url --docker-username=username --docker-password=password --docker-email=email
```

In the pkg folder:
```
helm package api-gateway

helm install api-gateway api-gateway-0.1.0.tgz

helm install -f values.yaml api-gateway api-gateway-0.1.0.tgz

helm upgrade -f values.yaml api-gateway api-gateway-0.1.0.tgz

helm uninstall api-gateway
```

Useful commands:
```
kubectl get pods

kubectl describe pod $POD_NAME

kubectl exec --stdin --tty $POD_NAME -- /bin/bash
```

Kubectl proxies for api-gateway and keycloak
```
# api-gateway
API_GATEWAY_POD_NAME=api-gateway-7dfdf6bbf5-p7g4w
kubectl port-forward --namespace default $API_GATEWAY_POD_NAME 5000

# keycloak
KEYCLOAK_POD_NAME=keycloak-0
kubectl port-forward --namespace default $KEYCLOAK_POD_NAME 8080
```

# Helmfile
Use the "local" or "prod" helmfile environment to start this service. Use
"local" for minikube (default admin credentials and URLs), use "prod" for cloud
deployment.
