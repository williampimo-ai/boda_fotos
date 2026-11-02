require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const path = require('path');

const app = express();

// Configurar multer con un límite de 15MB para fotos de alta calidad de celulares
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 } 
});

// Configuración de Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint para subir la foto
app.post('/api/upload', upload.single('foto'), async (req, res) => {
    try {
        const file = req.file;
        const nombre = req.body.nombre || 'Anónimo';

        if (!file) {
            return res.status(400).json({ error: 'No se ha subido ninguna imagen.' });
        }

        // Generar un nombre limpio y seguro
        const fileExt = path.extname(file.originalname || '.jpg').toLowerCase();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${fileExt}`;
        
        console.log('Intentando subir al bucket "fotos-boda" con el nombre:', fileName);

        // 1. Subir a Supabase Storage
        const { data: storageData, error: storageError } = await supabase.storage
            .from('fotos-boda')
            .upload(fileName, file.buffer, {
                contentType: file.mimetype,
                upsert: false
            });

        if (storageError) {
            console.error('Error en Supabase Storage:', storageError);
            throw storageError;
        }

        // 2. Obtener la URL pública
        const { data: { publicUrl } } = supabase.storage
            .from('fotos-boda')
            .getPublicUrl(fileName);

        // 3. Guardar el registro en la base de datos (tabla 'fotos')
        const { data: dbData, error: dbError } = await supabase
            .from('fotos')
            .insert([{ url: publicUrl, autor: nombre }]);

        if (dbError) {
            console.error('Error en la Base de Datos:', dbError);
            throw dbError;
        }

        res.status(200).json({ success: true, message: '¡Foto subida con éxito!' });
    } catch (error) {
        console.error('Error general en /api/upload:', error.message || error);
        res.status(500).json({ error: 'Hubo un error al procesar la imagen: ' + (error.message || 'Error desconocido') });
    }
});

// Endpoint para obtener todas las fotos
app.get('/api/fotos', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('fotos')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error al obtener fotos:', error);
        res.status(500).json({ error: 'Error al obtener las fotos.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});