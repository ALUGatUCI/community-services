# ALUG@UCI Community Services
This project provides the software-side aspect of ALUG@UCI Community Services, which provisions free LXD containers on a request-basis and enables ALUG@UCI members to host services open to the broader UCI community.

## Libraries/Technologies Used
- Uvicorn
- FastAPI
- LXD
- SQLModel
- PyJWT
- python-dotenv
- aiosmtpd

## Things that must be implemented:
- Implement email-based 2FA
- Cleaner web user interface (UI/UX)
- Implement Pocketbase support to prevent duplicate account creation across different sessions
- Switch over to Docker Compose

## Setting up a configuration
You will need a `.env` file to run in the same directory as `alugvps-server.py`. Here are the environment variables to specify in `.env`:

- "secret_key" - Use this command to generate a secret key: openssl rand -hex 32
- "port" - Connection Port
- "acc_limit" - Number of Accounts that can have Containers at a Given Time
- "cpu_limit" - CPU Core Limit for Containers
- "ram_limit" - RAM Limit for Containers
- "disk_limit" - Disk Space Limit for Containers
- "fingerprint_image" - LXC Container Image (See them via `lxc image list`)
- "email" - Email where communications will be sent from
- "email_key" - Email key
- "smtp_host" - SMTP Host
- "smtp_port" - SMTP Port

## Run via Docker
In the root directory of the source code, run this command:

`docker build -t alugvps-server .`

Once it has been built, initialize a Docker container with the following command:

```
docker run \
--mount type=bind,src={LXD Socket Directory},dst={LXD Socket Directory} \
--mount type=bind,src={Host .env File Directory},dst=/usr/local/alugvps-server/.env \
--mount type=bind,src={alugvps.db Database File on Host},dst={/var/lib/alugvps-server/alugvps.db} \
-p {Listening Port on Host}:{Connection Port in .env File} \
--name {Name Your Container} \
alugvps-server
```

The LXD Socket Directory will vary by system, however for Snap installations, it will be located at `/var/snap/lxd/common/lxd/unix.socket`. Otherwise, it will be at `/var/lib/lxd/unix.socket`. So mount whatever the location is in the specified parameters.

To run a container in insecure mode (recommended for testing purposes, run this command):

```
docker run \
--mount type=bind,src={LXD Socket Directory},dst={LXD Socket Directory} \
--mount type=bind,src={Host .env File Directory},dst=/usr/local/alugvps-server/.env \
--mount type=bind,src={alugvps.db Database File on Host},dst={/var/lib/alugvps-server/alugvps.db} \
-p {Listening Port on Host}:{Connection Port in .env File} \
-e ALUGVPS_SECURE_MODE=0 \
--name {Name Your Container} \
alugvps-server
```

This command follows the same structure, but adds the parameter `-e ALUGVPS_SECURE_MODE=0` to enable insecure mode.
