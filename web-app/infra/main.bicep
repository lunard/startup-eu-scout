// ──────────────────────────────────────────────────────────────────────────────
// EU Scout Web App — Azure Infrastructure (Bicep)
//
// Provisions:
//   • EU Scout container app (nginx + React SPA)
//
// Registry:   Azure Container Registry (existing, referenced)
// Auth:       Service principal with AcrPull role
// Custom DNS: eu-scout.codethecat.dev  (CNAME → ACA default FQDN)
// TLS:        Azure-managed certificate via CNAME validation
// ──────────────────────────────────────────────────────────────────────────────

@description('Name of the existing Container Apps environment to deploy into')
param environmentName string

@description('Azure region — must match the environment region')
param location string = resourceGroup().location

@description('Full image reference, e.g. myacr.azurecr.io/eu-scout-web:abc1234')
param image string

@description('ACR server hostname, e.g. myacr.azurecr.io')
param acrRegistry string

@description('ACR pull username (service principal appId)')
param acrUsername string

@description('ACR pull password (service principal secret)')
@secure()
param acrPassword string

@description('Proxy target for EU Funding & Tenders API')
param proxyEuApi string = 'https://api.tech.ec.europa.eu'

@description('Proxy target for OpenCorporates API')
param proxyOpenCorporatesApi string = 'https://api.opencorporates.com'

// ── Naming ────────────────────────────────────────────────────────────────────
var appName = 'eu-scout-web'

// ── Container Apps Environment (existing — shared with other services) ────────
resource containerEnv 'Microsoft.App/managedEnvironments@2024-03-01' existing = {
  name: environmentName
}

// ── EU Scout Container App ────────────────────────────────────────────────────
resource euScoutApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: appName
  location: location
  properties: {
    managedEnvironmentId: containerEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 80
        transport: 'auto'
        allowInsecure: false
      }
      registries: [
        {
          server: acrRegistry
          username: acrUsername
          passwordSecretRef: 'acr-password'
        }
      ]
      secrets: [
        { name: 'acr-password', value: acrPassword }
      ]
    }
    template: {
      containers: [
        {
          name: appName
          image: image
          resources: {
            // Static SPA served by nginx — very lightweight
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: [
            // Substituted by nginx envsubst at container start
            { name: 'PROXY_EU_API',                value: proxyEuApi }
            { name: 'PROXY_OPENCORPORATES_API',    value: proxyOpenCorporatesApi }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/healthz'
                port: 80
              }
              initialDelaySeconds: 5
              periodSeconds: 30
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/healthz'
                port: 80
              }
              initialDelaySeconds: 3
              periodSeconds: 10
            }
          ]
        }
      ]
      scale: {
        // Single replica — this is a static SPA with no server-side state.
        // Scale out later if needed.
        minReplicas: 1
        maxReplicas: 2
        rules: [
          {
            name: 'http-scaling'
            http: {
              metadata: {
                concurrentRequests: '100'
              }
            }
          }
        ]
      }
    }
  }
}

// ── Outputs ───────────────────────────────────────────────────────────────────
@description('Default ACA FQDN — use this as the CNAME target for eu-scout.codethecat.dev')
output fqdn string = euScoutApp.properties.configuration.ingress.fqdn

@description('Full HTTPS URL on the default ACA domain')
output defaultUrl string = 'https://${euScoutApp.properties.configuration.ingress.fqdn}'
