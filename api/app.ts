/**
 * Project Management Tool API Server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import taskRoutes from './routes/tasks'
import configRoutes from './routes/config'
import projectRoutes from './routes/projects'
import resourceRoutes from './routes/resources'
import baselineRoutes from './routes/baselines'
import calendarRoutes from './routes/calendars'
import templateRoutes from './routes/templates'
import importExportRoutes from './routes/importExport'
import './db/init'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

app.use('/api/tasks', taskRoutes)
app.use('/api/config', configRoutes)
app.use('/api/projects', projectRoutes)
app.use('/api/resources', resourceRoutes)
app.use('/api/baselines', baselineRoutes)
app.use('/api/calendars', calendarRoutes)
app.use('/api/templates', templateRoutes)
app.use('/api', importExportRoutes)

app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Server error:', error)
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
