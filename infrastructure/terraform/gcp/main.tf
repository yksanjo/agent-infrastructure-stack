# GCP Infrastructure for Agent Infrastructure Stack

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.gcp_project_id
  region  = var.gcp_region
}

# VPC
resource "google_compute_network" "vpc" {
  name                    = "${var.project_name}-vpc"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "subnet" {
  name          = "${var.project_name}-subnet"
  ip_cidr_range = "10.0.0.0/24"
  region        = var.gcp_region
  network       = google_compute_network.vpc.id

  private_ip_google_access = true
}

# Cloud Run - Protocol Adapter
resource "google_cloud_run_service" "protocol_adapter" {
  name     = "${var.project_name}-protocol-adapter"
  location = var.gcp_region

  template {
    spec {
      containers {
        image = "${var.gcr_repository}/protocol-adapter:${var.image_tag}"
        
        ports {
          container_port = 8080
        }
        
        env {
          name  = "NODE_ENV"
          value = "production"
        }
        
        resources {
          limits = {
            cpu    = "1"
            memory = "512Mi"
          }
        }
      }
      
      service_account_name = google_service_account.cloud_run.email
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }

  depends_on = [google_project_service.cloud_run]
}

# Cloud Run - Intent Router
resource "google_cloud_run_service" "intent_router" {
  name     = "${var.project_name}-intent-router"
  location = var.gcp_region

  template {
    spec {
      containers {
        image = "${var.gcr_repository}/intent-router:${var.image_tag}"
        
        ports {
          container_port = 8081
        }
        
        env {
          name  = "EMBEDDING_MODEL"
          value = "text-embedding-3-small"
        }
        
        resources {
          limits = {
            cpu    = "2"
            memory = "2Gi"
          }
        }
      }
      
      service_account_name = google_service_account.cloud_run.email
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }

  depends_on = [google_project_service.cloud_run]
}

# Memorystore (Redis) for caching
resource "google_redis_instance" "cache" {
  name           = "${var.project_name}-cache"
  tier           = "STANDARD_HA"
  memory_size_gb = 1
  region         = var.gcp_region

  redis_configs = {
    maxmemory-policy = "allkeys-lru"
  }
}

# Service Account
resource "google_service_account" "cloud_run" {
  account_id   = "${var.project_name}-sa"
  display_name = "Agent Infrastructure Service Account"
}

# Enable APIs
resource "google_project_service" "cloud_run" {
  service = "run.googleapis.com"
}

resource "google_project_service" "redis" {
  service = "redis.googleapis.com"
}

# Cloud Build trigger
resource "google_cloudbuild_trigger" "main" {
  name     = "${var.project_name}-build"
  filename = "cloudbuild.yaml"

  github {
    owner = var.github_owner
    name  = var.github_repo
    
    push {
      branch = "^main$"
    }
  }
}

# Outputs
output "protocol_adapter_url" {
  value = google_cloud_run_service.protocol_adapter.status[0].url
}

output "intent_router_url" {
  value = google_cloud_run_service.intent_router.status[0].url
}

output "redis_host" {
  value = google_redis_instance.cache.host
}
