import { createAzure } from '@ai-sdk/azure'

// Extract resource name from endpoint
// Endpoint: https://nextgen-east-us2.openai.azure.com -> resourceName: nextgen-east-us2
const endpoint = process.env.AZURE_OPENAI_ENDPOINT || "";
const resourceName = endpoint.replace("https://", "").replace(".openai.azure.com", "").replace(/\/$/, "") || "nextgen-east-us2";

export const azure = createAzure({
  resourceName,
  apiKey: process.env.AZURE_OPENAI_API_KEY,
})

export const model = azure(process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-5-mini')
