import {handler} from '../functions/invoices'
import { logError, logInfo } from '../utils/logger'
import { event } from './events/lambda'

handler(event as any).then((res)=>{
    logInfo("Lambda Response", "Response", JSON.stringify(res))
}).catch(error=> logError("Lambda Response", "Error", error))