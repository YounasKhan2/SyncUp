import { Account, Client } from 'appwrite'

export const appwriteClient = new Client()
  .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1')
  .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID || '6abcafcb003218a34a55')

export const appwriteAccount = new Account(appwriteClient)
