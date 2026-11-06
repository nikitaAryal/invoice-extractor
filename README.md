## Getting Started

Follow these steps to set up and run the project locally.

### 1. Prerequisites

Make sure the following tools are installed on your system:

- [Node.js](https://nodejs.org/) and npm
- Git
- Visual Studio Code or any preferred code editor

### 2. Clone the Repository

Clone the repository and navigate to the project directory:

```bash
git clone <repository-url>
cd invoice-ocr
```

### 3. Install Dependencies

Install the required dependencies for the project.

For the backend:

```bash
cd backend
npm install
```

For the frontend, open a new terminal and navigate to the frontend directory:

```bash
cd frontend
npm install
```

### 4. Running the Backend

The backend is responsible for handling server-side operations, invoice processing, and communication with the frontend.

Navigate to the backend directory:

```bash
cd backend
```

Start the server using:

```bash
npm start
```

The backend server should start on the configured port.

### 5. Running the Frontend

The frontend is built using React and Vite. It provides the user interface for uploading invoices, reviewing extracted information, and interacting with the application.

Navigate to the frontend directory:

```bash
cd frontend
```

Start the development server:

```bash
npm run dev
```

Once the server starts, open the local URL provided in the terminal, usually:

```text
http://localhost:5173
```

### 6. Running the Application

To run the application locally, both the frontend development server and the backend server must be running simultaneously.

- The backend handles invoice processing and API requests.
- The frontend provides the interface and communicates with the backend.

Open separate terminals for the frontend and backend to keep both servers running.

### Notes

- Make sure all required dependencies are installed before starting the application.
- Keep the frontend and backend running while using the application.
