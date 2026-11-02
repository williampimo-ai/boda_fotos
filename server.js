require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const path = require('path');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Configuración de Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint para subir la foto
app.post('/api/upload', upload.single('foto'), async (req, res) => {
    try {
        const file = req.file;
        const nombre = req.body.nombre || 'Anónimo';

        if (!file) {
            return res.status(400).json({ error: 'No se ha subido ninguna imagen.' });
        }

        const fileName = `${Date.now()}-${file.originalname}`;
        
        // 1. Subir a Supabase Storage
        const { data: storageData, error: storageError } = await supabase.storage
            .from('fotos-boda')
            .upload(fileName, file.buffer, {
                contentType: file.mimetype
            });

        if (storageError) throw storageError;

        // 2. Obtener la URL pública
        const { data: { publicUrl } } = supabase.storage
            .from('fotos-boda')
            .getPublicUrl(fileName);

        // 3. Guardar el registro en la base de datos (tabla 'fotos')
        const { data: dbData, error: dbError } = await supabase
            .from('fotos')
            .insert([{ url: publicUrl, autor: nombre }]);

        if (dbError) throw dbError;

        res.status(200).json({ success: true, message: '¡Foto subida con éxito!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Hubo un error al procesar la imagen.' });
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
        res.status(500).json({ error: 'Error al obtener las fotos.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});