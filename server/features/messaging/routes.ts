import { Router } from 'express'
import { requireAuth } from '../auth/middleware.js'
import { chatRoutes } from './routes/chats.js'
import { discoveryRoutes } from './routes/discovery.js'
import { messageRoutes } from './routes/messages.js'
import { requestRoutes } from './routes/requests.js'
import { safetyRoutes } from './routes/safety.js'
import { searchRoutes } from './routes/search.js'
import { spaceRoutes } from '../spaces/routes.js'

export const messagingRouter = Router()
messagingRouter.use(requireAuth, spaceRoutes, searchRoutes, discoveryRoutes, chatRoutes, requestRoutes, messageRoutes, safetyRoutes)
