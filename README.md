# InnControl Frontend

InnControl es una plataforma moderna y minimalista para la gestión hotelera, enfocada en la experiencia de usuario y la eficiencia operativa. Este repositorio contiene el **Frontend** desarrollado con React y Vite.

## Tecnologías Utilizadas

*   **React 18**
*   **Vite** (Herramienta de desarrollo rápida)
*   **Tailwind CSS** (Framework de estilos responsive)
*   **Lucide React** (Set de iconos minimalistas)
*   **Axios** (Cliente HTTP para la API)
*   **Zustand** (Gestión de estado global)
*   **Framer Motion** (Biblioteca de animaciones)

## Diseño y Experiencia

El frontend ha sido diseñado buscando una interfaz moderna y fluida:
*   **Modo Oscuro/Claro**: Soporte nativo con persistencia local.
*   **Glassmorphism**: Estilo visual basado en transparencias y desenfoques.
*   **Micro-animaciones**: Transiciones entre páginas y estados de componentes.
*   **Dashboard Dinámico**: Vista personalizada según el rol del usuario (Gerente o Empleado).

## Características Principales

*   **Panel de Control**: Resumen estadístico de ocupación, tareas y stock.
*   **Gestión de Habitaciones**: Visualización por pisos y estados de limpieza.
*   **Tablero de Tareas**: Interfaz tipo Kanban para la gestión de labores.
*   **Inventario Visual**: Control de insumos con indicadores de stock crítico.
*   **Chat en Tiempo Real**: Comunicación directa entre el equipo.
*   **Responsive**: Optimizado para tablets y computadoras de escritorio.

## Instalación y Ejecución

1.  **Clonar el repositorio**:
    ```bash
    git clone https://github.com/tu-usuario/inncontrol-frontend.git
    ```

2.  **Instalar dependencias**:
    ```bash
    npm install
    ```

3.  **Configurar Variables de Entorno**:
    Crea un archivo `.env` en la raíz del proyecto:
    ```env
    VITE_API_URL=http://localhost:8080/api/v1
    ```

4.  **Ejecutar en desarrollo**:
    ```bash
    npm run dev
    ```

5.  **Construir para producción**:
    ```bash
    npm run build
    ```

---
Diseñado para la excelencia en el servicio hotelero.
