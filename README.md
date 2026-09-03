# CriptaLab

Laboratorio web para analizar cifrados clásicos César, Afín y Vigenère con el alfabeto español de 27 letras.

## Estructura

- `frontend/`: interfaz React + TypeScript.
- `backend/`: API Python + FastAPI.

La autenticación futura queda separada del laboratorio público. No debe habilitarse mientras el despliegue académico use HTTP sin TLS.

## Desarrollo local

1. En `backend`, cree el entorno virtual, instale `requirements.txt` y ejecute `python -m uvicorn app.main:app --reload`.
2. En `frontend`, ejecute `npm install` y `npm run dev`.
3. Abra `http://localhost:3000`.

## Producción en AWS

La carpeta `deploy/` contiene la configuración base de Nginx y las unidades `systemd` para una instancia EC2 con Amazon Linux 2023. Nginx publica el sitio en el puerto 80 y mantiene FastAPI y el servidor React accesibles solamente desde la propia instancia.
