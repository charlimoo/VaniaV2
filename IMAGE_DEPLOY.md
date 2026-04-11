# Image Build and Server Deploy Guide

This guide explains how to rebuild the production Docker images locally, export them as tar files, transfer them to the server, load them there, and run the app with the image-only compose file.

## Files

- Compose file for image-only deploy: `docker-compose.images.yml`
- Production env file: `prod.env`
- Exported images folder: `images/`

## Image tags

These commands use these image tags:

- Backend: `vaniaapp-backend:prod`
- Frontend: `vaniaapp-frontend:prod`

The compose file expects exactly these tags.

## 1. Build the images locally

### Backend

Run from the repo root:

```powershell
cd backend
docker build `
  --build-arg HTTP_PROXY=http://192.168.10.2:3129 `
  --build-arg HTTPS_PROXY=http://192.168.10.2:3129 `
  --build-arg http_proxy=http://192.168.10.2:3129 `
  --build-arg https_proxy=http://192.168.10.2:3129 `
  -t vaniaapp-backend:prod `
  .
```

### Frontend

The frontend build needs `NEXT_PUBLIC_API_URL` from `prod.env`.

```powershell
cd ..\frontend
$env:NEXT_PUBLIC_API_URL=(Select-String -Path ..\prod.env -Pattern '^NEXT_PUBLIC_API_URL=').ToString().Split('=')[1]
docker build `
  --build-arg HTTP_PROXY=http://192.168.10.2:3129 `
  --build-arg HTTPS_PROXY=http://192.168.10.2:3129 `
  --build-arg http_proxy=http://192.168.10.2:3129 `
  --build-arg https_proxy=http://192.168.10.2:3129 `
  --build-arg NEXT_PUBLIC_API_URL=$env:NEXT_PUBLIC_API_URL `
  -t vaniaapp-frontend:prod `
  .
```

## 2. Export the images as tar files

Create or reuse the repo root `images` folder, then export:

```powershell
cd ..\backend
docker save -o ..\images\vaniaapp-backend-prod.tar vaniaapp-backend:prod
docker save -o ..\images\vaniaapp-frontend-prod.tar vaniaapp-frontend:prod
```

You should then have:

- `images\vaniaapp-backend-prod.tar`
- `images\vaniaapp-frontend-prod.tar`

## 3. Optional validation before shipping

Validate the image-only compose file locally:

```powershell
cd ..
docker compose --env-file prod.env -f docker-compose.images.yml config
```

You can also confirm the images exist:

```powershell
docker image ls vaniaapp-backend:prod
docker image ls vaniaapp-frontend:prod
```

## 4. Copy files to the server

Transfer these files to the server:

- `docker-compose.images.yml`
- `prod.env`
- `images/vaniaapp-backend-prod.tar`
- `images/vaniaapp-frontend-prod.tar`

If the server does not have internet access and also needs infra images locally, export those separately too. The current compose file still references public images for:

- `postgres:15-alpine`
- `redis:7-alpine`
- `quay.io/minio/minio:RELEASE.2023-11-01T01-57-10Z-cpuv1`
- `qdrant/qdrant`

## 5. Load the images on the server

On the server, go to the directory containing the files and run:

```bash
docker load -i vaniaapp-backend-prod.tar
docker load -i vaniaapp-frontend-prod.tar
```

Confirm the tags after loading:

```bash
docker image ls vaniaapp-backend:prod
docker image ls vaniaapp-frontend:prod
```

## 6. Start the app on the server

Run the stack with the image-only compose file:

```bash
docker compose --env-file prod.env -f docker-compose.images.yml up -d
```

Useful follow-up commands:

```bash
docker compose --env-file prod.env -f docker-compose.images.yml ps
docker compose --env-file prod.env -f docker-compose.images.yml logs -f
docker compose --env-file prod.env -f docker-compose.images.yml restart
docker compose --env-file prod.env -f docker-compose.images.yml down
```

## 7. Updating later

When you need to deploy a new version:

1. Rebuild the backend and frontend images with the same tags.
2. Export the tar files again.
3. Copy the new tar files to the server.
4. Load them again with `docker load -i ...`.
5. Restart the stack:

```bash
docker compose --env-file prod.env -f docker-compose.images.yml up -d
```

If you want to force recreation of containers:

```bash
docker compose --env-file prod.env -f docker-compose.images.yml up -d --force-recreate
```

## 8. Notes

- The backend and frontend containers both depend on the image tags above staying unchanged unless you also update `docker-compose.images.yml`.
- The frontend bundle is built with the `NEXT_PUBLIC_API_URL` value from `prod.env` at build time.
- `prod.env` is used again at runtime by Docker Compose.
- If you want a fully offline deploy package, also export the infra images and load them on the server before running compose.
