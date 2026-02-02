variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "agent-infrastructure"
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "ecr_repository" {
  description = "ECR repository URL"
  type        = string
}

variable "image_tag" {
  description = "Docker image tag"
  type        = string
  default     = "latest"
}

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default = {
    Project     = "agent-infrastructure-stack"
    ManagedBy   = "terraform"
    Environment = "production"
  }
}
