# DevOps Technical Assignment - Syvora

A comprehensive DevOps project demonstrating containerization, CI/CD, Infrastructure as Code (IaC), Kubernetes orchestration, and monitoring with Prometheus.

## 📋 Table of Contents

- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Detailed Setup](#detailed-setup)
- [Monitoring & Alerts](#monitoring--alerts)
- [API Documentation](#api-documentation)
- [Project Structure](#project-structure)
- [Technologies Used](#technologies-used)
- [Troubleshooting](#troubleshooting)

---

## Project Overview

This project implements a production-ready Node.js REST API with PostgreSQL database, deployed on Kubernetes with comprehensive monitoring and alerting capabilities.

### Key Features

**Web Server Setup**
- Node.js Express backend with full CRUD operations
- PostgreSQL database integration
- Dockerized application with multi-stage builds
- Docker Compose for local development
- Health check endpoints

 **CI Pipeline**
- GitHub Actions workflow for automated builds
- Automatic Docker image builds on `main` branch pushes
- Docker images pushed to Docker Hub
- Security scanning with Trivy

**Infrastructure as Code**
- Kubernetes cluster provisioned using Terraform
- Kind (Kubernetes in Docker) for local development
- Automated namespace and resource management

**Kubernetes Deployment**
- Helm charts for backend application deployment
- PostgreSQL StatefulSet deployment
- NodePort service exposure
- Resource limits and health checks

**Monitoring & Alerting**
- Prometheus for metrics collection
- Custom metrics for HTTP requests (response time, status codes)
- Three critical alerts:
  - **BackendDown**: Triggers when service is unresponsive for >1 minute
  - **HighResponseTime**: Triggers when 95th percentile latency >2 seconds
  - **HighErrorRate**: Triggers when 5xx error rate >5%

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     GitHub Repository                        │
│                  (Source Code + CI/CD)                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │   GitHub Actions      │
         │  (Build & Push)       │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │     Docker Hub        │
         │  (Image Registry)     │
         └───────────┬───────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────┐
│              Kubernetes Cluster (Kind)                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                  app-namespace                       │  │
│  │  ┌──────────────┐         ┌──────────────┐         │  │
│  │  │   Backend    │────────▶│ PostgreSQL   │         │  │
│  │  │   (Node.js)  │         │   Database   │         │  │
│  │  └──────┬───────┘         └──────────────┘         │  │
│  │         │                                            │  │
│  │         │ /metrics                                   │  │
│  └─────────┼────────────────────────────────────────────┘  │
│            │                                                │
│  ┌─────────▼────────────────────────────────────────────┐  │
│  │              monitoring namespace                    │  │
│  │  ┌──────────────┐       ┌──────────────┐           │  │
│  │  │  Prometheus  │◀─────▶│   Grafana    │           │  │
│  │  │   (Metrics)  │       │ (Dashboards) │           │  │
│  │  └──────────────┘       └──────────────┘           │  │
│  │         │                                            │  │
│  │         └──────▶ Alerts (3 rules configured)        │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

---

##  Prerequisites

Before starting, ensure you have the following installed:

- **Docker Desktop** (v20.10+) - [Download](https://www.docker.com/products/docker-desktop)
- **kubectl** (v1.27+) - [Install Guide](https://kubernetes.io/docs/tasks/tools/)
- **Terraform** (v1.5+) - [Download](https://www.terraform.io/downloads)
- **Helm** (v3.12+) - [Install Guide](https://helm.sh/docs/intro/install/)
- **Git** - [Download](https://git-scm.com/downloads)
- **Node.js** (v18+) - Optional, for local development

### Verify Installation

```bash
docker --version
kubectl version --client
terraform --version
helm version
```

---

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/Aeshna0204/Devops-Technical-Assignment.git
cd syvora-devops-assignment
```

### 2. Run with Docker Compose (Local Development)

```bash
# Start application and database
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Access API
curl http://localhost:3000/health
```

**Access Points:**
- API: http://localhost:3000
- Metrics: http://localhost:3000/metrics

### 3. Deploy to Kubernetes

```bash
# Navigate to terraform directory
cd terraform

# Initialize Terraform
terraform init

# Create Kubernetes cluster and deploy everything
terraform apply -auto-approve

# Wait for all pods to be ready (2-3 minutes)
kubectl wait --for=condition=ready pod --all -n app-namespace --timeout=300s
kubectl wait --for=condition=ready pod --all -n monitoring --timeout=300s
```

### 4. Access Services

```bash
# Backend API (via NodePort)
curl http://localhost:3000/health

# Prometheus
kubectl port-forward -n monitoring svc/prometheus-kube-prometheus-prometheus 9090:9090
# Open: http://localhost:9090

```

---

## Detailed Setup

### Local Development with Docker Compose

The `docker-compose.yml` provides a complete local development environment.

```bash
# Start services
docker-compose up -d

# Run migrations/init (automatic via init.sql)
# Database is automatically initialized

# Stop services
docker-compose down

# Remove volumes (clean slate)
docker-compose down -v
```

### Kubernetes Deployment Details

#### Terraform Infrastructure

The Terraform configuration (`terraform/main.tf`) creates:

1. **Kind Cluster**: 3-node cluster (1 control-plane, 2 workers)
2. **Namespaces**: 
   - `app-namespace` - Application resources
   - `monitoring` - Prometheus/Grafana stack
3. **PostgreSQL**: StatefulSet with persistent storage
4. **Backend Application**: Deployed via Helm chart
5. **Prometheus Stack**: Full monitoring solution via kube-prometheus-stack
6. **ServiceMonitor**: Automatic metrics scraping configuration

```bash
# View Terraform plan
terraform plan

# Apply infrastructure
terraform apply

# Destroy everything
terraform destroy
```

#### Helm Chart Structure

```
backend/
├── Chart.yaml              # Chart metadata
├── values.yaml             # Default configuration values
└── templates/
    ├── deployment.yaml     # Backend deployment
    ├── service.yaml        # Service with metrics annotations
    ├── serviceaccount.yaml # RBAC service account
    └── tests/              # Helm tests
```

**Key Helm Values:**
- Image: `aeshna24/devops-assignment:latest`
- Replicas: 1 (configurable)
- Service Type: NodePort (port 30000 → 3001 on host)
- Resources: 
  - Requests: 100m CPU, 128Mi Memory
  - Limits: 250m CPU, 256Mi Memory

#### Deploying Updates

```bash
# Upgrade backend application
helm upgrade my-backend ./backend -n app-namespace

# Rollback if needed
helm rollback my-backend -n app-namespace

# View release history
helm history my-backend -n app-namespace
```

---

##  Monitoring & Alerts

### Prometheus Metrics

The application exposes custom metrics at `/metrics`:

**HTTP Request Metrics:**
- `http_request_duration_seconds_bucket` - Histogram of request durations
- `http_request_duration_seconds_count` - Total request count
- `http_request_duration_seconds_sum` - Sum of all request durations
- `http_requests_total` - Counter of HTTP requests by method, route, status

**Node.js Metrics:**
- `node_app_process_cpu_user_seconds_total` - CPU usage
- `node_app_process_resident_memory_bytes` - Memory usage
- `node_app_nodejs_heap_size_total_bytes` - Heap memory
- And many more default Node.js metrics

### Alert Rules

Three critical alerts are configured:

#### 1. BackendDown Alert
```yaml
Alert: BackendDown
Severity: Critical
Condition: up{job="my-backend"} == 0
Duration: 1 minute
Description: Backend service is not responding to health checks
```

**Resolution:** 
```bash
# Check pod status
kubectl get pods -n app-namespace

# Restart if needed
kubectl rollout restart deployment -n app-namespace -l app.kubernetes.io/name=backend
```

#### 2. HighResponseTime Alert
```yaml
Alert: HighResponseTime
Severity: Warning
Condition: 95th percentile response time > 2 seconds
Duration: 1 minute
Description: API response time is degraded
```

**Resolution:**
```bash
# Scale up replicas
kubectl scale deployment -n app-namespace -l app.kubernetes.io/name=backend --replicas=2

# Check resource usage
kubectl top pods -n app-namespace
```

#### 3. HighErrorRate Alert
```yaml
Alert: HighErrorRate
Severity: Warning
Condition: 5xx error rate > 5%
Duration: 2 minutes
Description: High rate of server errors
```

**Resolution:**
```bash
# Check logs for errors
kubectl logs -n app-namespace -l app.kubernetes.io/name=backend --tail=100

# Restart if needed
kubectl rollout restart deployment -n app-namespace -l app.kubernetes.io/name=backend
```

### Accessing Monitoring Tools

**Prometheus UI:**
```bash
kubectl port-forward -n monitoring svc/prometheus-kube-prometheus-prometheus 9090:9090
```
- Alerts: http://localhost:9090/alerts
- Targets: http://localhost:9090/targets

### Example Queries

```promql
# 95th percentile response time
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{job="my-backend"}[5m])) by (le))

# Request rate per minute
rate(http_request_duration_seconds_count{job="my-backend"}[1m]) * 60

# Error rate percentage
sum(rate(http_request_duration_seconds_count{job="my-backend",status_code=~"5.."}[5m])) / sum(rate(http_request_duration_seconds_count{job="my-backend"}[5m])) * 100

# Total requests
sum(http_request_duration_seconds_count{job="my-backend"})
```

---

## API Documentation

Base URL: `http://localhost:3001` (Kubernetes) or `http://localhost:3000` (Docker Compose)

### Endpoints

#### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "uptime": 123.456,
  "timestamp": "2025-10-25T10:30:00.000Z",
  "database": "connected"
}
```

#### Get All Users
```http
GET /users
```

**Response:**
```json
[
  {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com"
  }
]
```

#### Create User
```http
POST /users
Content-Type: application/json

{
  "name": "Jane Smith",
  "email": "jane@example.com"
}
```

**Response (201):**
```json
{
  "id": 2,
  "name": "Jane Smith",
  "email": "jane@example.com"
}
```

**Validation Rules:**
- Name and email are required
- Both must be non-empty after trimming
- Maximum 50 characters each
- Email must be valid format
- Email must be unique

#### Update User
```http
PUT /users/:id
Content-Type: application/json

{
  "name": "Jane Doe",
  "email": "jane.doe@example.com"
}
```

**Response (200):**
```json
{
  "id": 2,
  "name": "Jane Doe",
  "email": "jane.doe@example.com"
}
```

#### Delete User
```http
DELETE /users/:id
```

**Response (200):**
```json
{
  "message": "deleted successfully"
}
```

### Example Usage

```bash
# Create a user
curl -X POST http://localhost:3001/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com"}'

# Get all users
curl http://localhost:3001/users

# Update user
curl -X PUT http://localhost:3001/users/1 \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice Updated","email":"alice.updated@example.com"}'

# Delete user
curl -X DELETE http://localhost:3001/users/1
```

---

## Project Structure

```
.
├── .github/
│   └── workflows/
│       └── docker-build.yml       # CI/CD pipeline
├── backend/                       # Helm chart
│   ├── Chart.yaml
│   ├── values.yaml
│   └── templates/
│       ├── deployment.yaml
│       ├── service.yaml
│       ├── serviceaccount.yaml
│       └── tests/
├── terraform/                     # Infrastructure as Code
│   ├── main.tf                   # Main Terraform configuration
│   ├── prometheus-values.yaml    # Prometheus Helm values
│   ├── alert-rules.yaml          # Alert definitions
│   └── servicemonitor.yaml       # Metrics scraping config
├── db/
│   └── init.sql                  # Database initialization
├── server.js                     # Node.js application
├── package.json                  # Node.js dependencies
├── Dockerfile                    # Multi-stage Docker build
├── docker-compose.yml            # Local development setup
├── .dockerignore
├── .gitignore
└── README.md                     # This file
```

---

##  Technologies Used

### Backend
- **Node.js** (v18) - JavaScript runtime
- **Express.js** (v5) - Web framework
- **PostgreSQL** (v15) - Relational database
- **pg** - PostgreSQL client for Node.js
- **prom-client** - Prometheus metrics client

### DevOps & Infrastructure
- **Docker** - Containerization
- **Docker Compose** - Local orchestration
- **Kubernetes** (Kind) - Container orchestration
- **Helm** (v3) - Kubernetes package manager
- **Terraform** - Infrastructure as Code

### Monitoring
- **Prometheus** - Metrics collection & alerting
- **kube-prometheus-stack** - Complete monitoring solution

### CI/CD
- **GitHub Actions** - Automation pipeline
- **Trivy** - Container security scanning
- **Docker Hub** - Container registry

---

##  Troubleshooting

### Common Issues

#### 1. Pods Not Starting

```bash
# Check pod status
kubectl get pods -n app-namespace
kubectl get pods -n monitoring

# Describe pod for events
kubectl describe pod <pod-name> -n app-namespace

# Check logs
kubectl logs <pod-name> -n app-namespace
```

#### 2. Database Connection Issues

```bash
# Verify PostgreSQL is running
kubectl get pods -n app-namespace | grep postgresql

# Test connection from backend pod
kubectl exec -it <backend-pod> -n app-namespace -- sh
# Inside pod:
nc -zv postgresql 5432
```

#### 3. Metrics Not Appearing in Prometheus

```bash
# Check ServiceMonitor
kubectl get servicemonitor -n monitoring
kubectl describe servicemonitor my-backend-servicemonitor -n monitoring

# Verify service labels match
kubectl get svc my-backend -n app-namespace -o yaml | grep labels: -A 5

# Check Prometheus targets
kubectl port-forward -n monitoring svc/prometheus-kube-prometheus-prometheus 9090:9090
# Open: http://localhost:9090/targets
```

#### 4. Alerts Not Firing

```bash
# Check PrometheusRule
kubectl get prometheusrules -n monitoring

# Verify alert rules are loaded
# Port-forward to Prometheus and visit: http://localhost:9090/rules

# Check if metrics exist for alerts
kubectl port-forward -n monitoring svc/prometheus-kube-prometheus-prometheus 9090:9090
# Query: up{job="my-backend"}
```

#### 5. Helm Release Issues

```bash
# Check Helm releases
helm list -n app-namespace

# Get release status
helm status my-backend -n app-namespace

# If stuck, rollback
helm rollback my-backend -n app-namespace
```

### Reset Everything

```bash
# Docker Compose
docker-compose down -v

# Kubernetes
cd terraform
terraform destroy -auto-approve

# Clean Docker
docker system prune -a --volumes
```

---

## CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/docker-build.yml`) automatically:

1. **Triggers on:**
   - Push to `main` branch
   - Pull requests to `main`

2. **Build Steps:**
   - Checkout code
   - Set up Docker Buildx
   - Log in to Docker Hub
   - Extract metadata (tags, labels)
   - Build and push Docker image
   - Run Trivy security scan
   - Upload scan results to GitHub Security

3. **Image Tags:**
   - `latest` - Always points to latest main branch
   - `main-<git-sha>` - Specific commit reference
   - Branch name - For feature branches

**Docker Hub Repository:** `aeshna24/devops-assignment`

---

## Assignment Requirements Checklist

- Simple Node.js backend service with CRUD operations
- PostgreSQL database integration
- Application dockerized with multi-stage build
- Docker Compose for local development
- CI pipeline builds Docker image on `main` branch push
- Docker images pushed to Docker Hub
- Kubernetes cluster created using Terraform (IaC)
- Backend deployed in Kubernetes using Helm charts
- Prometheus monitoring setup collecting response time & HTTP status codes
- Alerts configured for server unresponsiveness
- Alerts configured for response time exceeding threshold
- Source code is reviewable and executable with minimal effort
- Comprehensive documentation (this README)

---


**Note:** This project is designed to run entirely on a local machine using Kind (Kubernetes in Docker). No cloud resources are required.
