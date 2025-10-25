terraform {
  required_providers {
    kind = {
      source  = "tehcyx/kind"
      version = "~> 0.4"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.2"
    }
  }
}

provider "kind" {}

provider "kubernetes" {
  host                   = kind_cluster.app_cluster.endpoint
  client_certificate     = kind_cluster.app_cluster.client_certificate
  client_key             = kind_cluster.app_cluster.client_key
  cluster_ca_certificate = kind_cluster.app_cluster.cluster_ca_certificate
}

provider "helm" {
  kubernetes {
    host                   = kind_cluster.app_cluster.endpoint
    client_certificate     = kind_cluster.app_cluster.client_certificate
    client_key             = kind_cluster.app_cluster.client_key
    cluster_ca_certificate = kind_cluster.app_cluster.cluster_ca_certificate
  }
}


# Create Kind cluster
resource "kind_cluster" "app_cluster" {
  name = "devops-assignment-cluster"
  
  kind_config {
    kind        = "Cluster"
    api_version = "kind.x-k8s.io/v1alpha4"

    node {
      role = "control-plane"
      
      # Port mappings for accessing services
      extra_port_mappings {
        container_port = 30080
        host_port      = 8081
        protocol       = "TCP"
      }
      
      extra_port_mappings {
        container_port = 30090
        host_port      = 9091
        protocol       = "TCP"
      }
      
      extra_port_mappings {
        container_port = 30000
        host_port      = 3001
        protocol       = "TCP"
      }
    }

    node {
      role = "worker"
    }

    node {
      role = "worker"
    }
  }

  wait_for_ready = true
}

# Create namespace for application
resource "kubernetes_namespace" "app" {
  metadata {
    name = "app-namespace"
    labels = {
      name = "app-namespace"
      environment = "development"
    }
  }
  
  depends_on = [kind_cluster.app_cluster]
}

# Create namespace for monitoring
resource "kubernetes_namespace" "monitoring" {
  metadata {
    name = "monitoring"
    labels = {
      name = "monitoring"
    }
  }
  
  depends_on = [kind_cluster.app_cluster]
}


# Create ConfigMap for Prometheus alert rules
resource "kubernetes_config_map" "prometheus_alert_rules" {
  metadata {
    name      = "prometheus-alert-rules"
    namespace = "monitoring"
  }

  data = {
    "alert-rules.yaml" = file("${path.module}/alert-rules.yaml")
  }
}

# Install Prometheus using Helm
resource "helm_release" "prometheus" {
  name       = "prometheus"
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "kube-prometheus-stack"
  namespace  = kubernetes_namespace.monitoring.metadata[0].name
  version    = "54.0.0"

  values = [
    file("${path.module}/prometheus-values.yaml")
  ]

  timeout = 600
  
  depends_on = [
    kubernetes_config_map.prometheus_alert_rules
  ]
}

resource "kubernetes_manifest" "backend_servicemonitor" {
  manifest = {
    apiVersion = "monitoring.coreos.com/v1"
    kind       = "ServiceMonitor"
    metadata = {
      name      = "my-backend-servicemonitor"
      namespace = kubernetes_namespace.monitoring.metadata[0].name
      labels = {
        release = "prometheus"
      }
    }
    spec = {
      selector = {
        matchLabels = {
          "app.kubernetes.io/name"     = "backend"     # ✅ Changed to match Helm
          "app.kubernetes.io/instance" = "my-backend"  # ✅ Changed to match Helm
        }
      }
      namespaceSelector = {
        matchNames = [kubernetes_namespace.app.metadata[0].name]
      }
      endpoints = [
        {
          port     = "http"
          path     = "/metrics"
          interval = "15s"
        }
      ]
    }
  }

  depends_on = [helm_release.prometheus, helm_release.backend]
}



# Simple PostgreSQL Deployment
resource "kubernetes_deployment" "postgresql" {
  metadata {
    name      = "postgresql"
    namespace = kubernetes_namespace.app.metadata[0].name
    labels = {
      app = "postgresql"
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "postgresql"
      }
    }

    template {
      metadata {
        labels = {
          app = "postgresql"
        }
      }

      spec {
        container {
          name  = "postgresql"
          image = "postgres:15-alpine"

          env {
            name  = "POSTGRES_USER"
            value = "user"
          }

          env {
            name  = "POSTGRES_PASSWORD"
            value = "password"
          }

          env {
            name  = "POSTGRES_DB"
            value = "testdb"
          }

          port {
            container_port = 5432
            name          = "postgresql"
          }

          resources {
            requests = {
              cpu    = "100m"
              memory = "128Mi"
            }
            limits = {
              cpu    = "250m"
              memory = "256Mi"
            }
          }

          readiness_probe {
            exec {
              command = ["pg_isready", "-U", "user","-d","testdb"]
            }
            initial_delay_seconds = 5
            period_seconds        = 5
          }

          liveness_probe {
            exec {
              command = ["pg_isready", "-U", "user","-d","testdb"]
            }
            initial_delay_seconds = 15
            period_seconds        = 10
          }
        }
      }
    }
  }

  depends_on = [kubernetes_namespace.app]
}

# PostgreSQL Service
resource "kubernetes_service" "postgresql" {
  metadata {
    name      = "postgresql"
    namespace = kubernetes_namespace.app.metadata[0].name
  }

  spec {
    selector = {
      app = "postgresql"
    }

    port {
      port        = 5432
      target_port = 5432
    }

    type = "ClusterIP"
  }

  depends_on = [kubernetes_deployment.postgresql]
}

# Deploy Backend App using Helm
resource "helm_release" "backend" {
  name       = "my-backend"
  chart      = "../backend"  
  namespace  = kubernetes_namespace.app.metadata[0].name
  values     = [file("../backend/values.yaml")]
  timeout    = 600
  
  depends_on = [
    kubernetes_namespace.app,
    kubernetes_service.postgresql  # Changed from helm_release.postgresql
  ]
}

# Output cluster information
output "cluster_name" {
  value = kind_cluster.app_cluster.name
}

output "cluster_endpoint" {
  value = kind_cluster.app_cluster.endpoint
}

output "kubeconfig_path" {
  value = "~/.kube/config"
}

output "app_namespace" {
  value = kubernetes_namespace.app.metadata[0].name
}

output "monitoring_namespace" {
  value = kubernetes_namespace.monitoring.metadata[0].name
}

output "access_instructions" {
  value = <<-EOT
    Cluster created successfully!
    
    To access your services:
    - Application API: http://localhost:3000
    - Prometheus: http://localhost:9090
    - Grafana: http://localhost:8080 (admin/prom-operator)
    
    Next steps:
    1. Deploy your application: helm install myapp ./helm-chart -n app-namespace
    2. Check pods: kubectl get pods -n app-namespace
    3. Access Prometheus: kubectl port-forward -n monitoring svc/prometheus-kube-prometheus-prometheus 9090:9090
  EOT
}