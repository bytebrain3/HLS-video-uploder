import express from 'express';
import { imageController } from '../controller/controller.image.js';

const router = express.Router()

router.post('/upload',imageController);
export default router
