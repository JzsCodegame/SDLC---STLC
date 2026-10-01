terraform {
  required_version = ">= 1.10.0, < 2.0.0"
  required_providers {
    coder        = { source = "coder/coder", version = "= 2.18.0" }
    digitalocean = { source = "digitalocean/digitalocean", version = "= 2.100.0" }
  }
}

provider "coder" {}
provider "digitalocean" {}

variable "app_git_url" {
  type        = string
  description = "Read-only HTTPS Git URL containing automation-lab/practice-app (JzsCodegame/SDLC---STLC)"
  validation {
    condition     = can(regex("^https://github\\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+\\.git$", var.app_git_url))
    error_message = "Use a public read-only GitHub HTTPS .git URL."
  }
}

variable "app_git_commit" {
  type        = string
  description = "Reviewed immutable commit containing the practice app"
  validation {
    condition     = can(regex("^[0-9a-f]{40}$", var.app_git_commit))
    error_message = "Pin a full 40-character Git commit SHA."
  }
}

data "coder_workspace" "me" {}
data "coder_workspace_owner" "me" {}

resource "coder_agent" "main" {
  os   = "linux"
  arch = "amd64"
  metadata {
    key          = "cpu"
    display_name = "CPU"
    interval     = 30
    timeout      = 10
    script       = "coder stat cpu"
  }
  metadata {
    key          = "memory"
    display_name = "Memory"
    interval     = 30
    timeout      = 10
    script       = "coder stat mem"
  }
}

resource "digitalocean_volume" "home" {
  region                   = "nyc3"
  name                     = "quiz-${data.coder_workspace.me.id}-home"
  size                     = 25
  initial_filesystem_type  = "ext4"
  initial_filesystem_label = "quiz-home"
  lifecycle { prevent_destroy = true }
}

resource "digitalocean_tag" "student" {
  name = "quiz-${data.coder_workspace.me.id}"
}

resource "digitalocean_droplet" "student" {
  count      = data.coder_workspace.me.start_count
  image      = "debian-12-x64"
  name       = "quiz-${substr(data.coder_workspace.me.id, 0, 8)}"
  region     = "nyc3"
  size       = "s-2vcpu-4gb"
  volume_ids = [digitalocean_volume.home.id]
  monitoring = true
  tags       = [digitalocean_tag.student.name]
  depends_on = [digitalocean_firewall.student]
  user_data = templatefile("${path.module}/cloud-config.yaml.tftpl", {
    agent_token    = coder_agent.main.token
    agent_init_b64 = base64encode(coder_agent.main.init_script)
    bootstrap_b64  = filebase64("${path.module}/bootstrap.sh")
    app_git_url    = var.app_git_url
    app_git_commit = var.app_git_commit
  })
}

resource "digitalocean_firewall" "student" {
  count = data.coder_workspace.me.start_count
  name  = "quiz-${substr(data.coder_workspace.me.id, 0, 8)}"
  tags  = [digitalocean_tag.student.name]
  outbound_rule {
    protocol              = "tcp"
    port_range            = "80"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
  outbound_rule {
    protocol              = "tcp"
    port_range            = "443"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
  outbound_rule {
    protocol              = "udp"
    port_range            = "53"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
  outbound_rule {
    protocol              = "tcp"
    port_range            = "53"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
  outbound_rule {
    protocol              = "udp"
    port_range            = "123"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}

resource "coder_app" "ide" {
  agent_id     = coder_agent.main.id
  slug         = "ide"
  display_name = "Browser IDE"
  url          = "http://127.0.0.1:13337/?folder=/home/coder"
  subdomain    = true
  share        = "owner"
  healthcheck {
    url       = "http://127.0.0.1:13337/healthz"
    interval  = 10
    threshold = 12
  }
}

resource "coder_app" "browser" {
  agent_id     = coder_agent.main.id
  slug         = "browser"
  display_name = "Live Browser"
  url          = "http://127.0.0.1:6080/vnc.html?autoconnect=1&resize=remote"
  subdomain    = true
  share        = "owner"
}

resource "coder_app" "preview" {
  agent_id     = coder_agent.main.id
  slug         = "preview"
  display_name = "App Preview"
  url          = "http://127.0.0.1:4173"
  subdomain    = true
  share        = "owner"
  healthcheck {
    url       = "http://127.0.0.1:4173/api/health"
    interval  = 10
    threshold = 12
  }
}
