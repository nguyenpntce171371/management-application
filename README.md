# Real Estate Valuation & Management System

A comprehensive web application for Real Estate Management and Professional Property Valuation. It features a micro-service architecture, real-time updates (Socket.io), offline-first capabilities (IndexedDB), and a deep Excel formula generation engine for appraisal worksheets.

![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![React](https://img.shields.io/badge/React-Vite-blue)
![Docker](https://img.shields.io/badge/Docker-Compose-orange)
![Status](https://img.shields.io/badge/Status-Active-success)

## Key Features

- **Appraisal Logic**: Complex valuation worksheets with land type adjustments, compatible with Excel formula export.
- **Offline-First**: Client-side `IndexedDB` integration ensures data safety during connection loss.
- **Security**: RBAC, Device Binding, Rate Limiting, HPP & NoSQL Injection protection.
- **Infrastructure**: Integrated with Oracle Cloud (OCI) for storage and Redis for session management.

## Prerequisites

* Docker & Docker Compose
* Node.js (optional, for local intellisense)
* Google OAuth2 Credentials (required for login)

## Configuration

Create a `.env` file in the root directory.

```cp .env.example .env```

## Required Variables

| Variable         | Description                                                                 |
|------------------|------------------------------------------------------------------------------|
| `APP_MODE`       | `development` hoặc `production` (Điều khiển logic build trong `run.sh`)     |
| `DOMAIN`         | Domain dùng cho cookies và CORS (ví dụ: `localhost`)                        |
| `MONGO_*`        | Thông tin kết nối MongoDB                                                    |
| `REDIS_PASSWORD` | Khóa bảo mật cho Redis session store                                         |
| `OCI_*`          | Khóa Oracle Cloud Infrastructure dùng cho lưu trữ file                      |
| `GOOGLE_*`       | Client ID / Client Secret cho đăng nhập OAuth2                              |

## Installation & Usage

The project uses a `run.sh` script to handle environment detection, cache clearing, and container orchestration.

### 1. Start the Application

```bash
# Give execution permission
chmod +x run.sh

# Run the deployment script
./run.sh
```

The script will automatically:
* Detect APP_MODE from .env.
* Select the correct docker-compose file.
* Production mode: Clean dist/, reinstall dependencies, and rebuild frontend.
* Development mode: Start containers with hot-reload support.

### 2. Common Commands

```python
# View logs (if your APP_MODE is development)
sudo docker compose -f docker-compose.development.yml logs -f

# Check container status (if your APP_MODE is development)
sudo docker compose -f docker-compose.development.yml ps

# Stop all services (if your APP_MODE is development)
sudo docker compose -f docker-compose.development.yml down
```

## Access & First Run

* Frontend: http://localhost (or your configured domain).
* Admin Access: The system automatically assigns Admin role to the first user.
* Code Server (Dev mode): https://code.<YOUR_DOMAIN>
