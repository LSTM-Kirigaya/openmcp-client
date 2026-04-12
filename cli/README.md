# OpenMCP CLI

CLI tool for OpenMCP - Quickly setup and run OpenMCP development environment.

## Installation

```bash
npm install -g openmcp-cli
```

## Requirements

- Node.js >= 18.0.0
- Git
- npm, yarn, or pnpm

## Usage

### Initialize a new project

```bash
openmcp init my-project
cd my-project
```

### Start development mode

Start both service (backend) and renderer (frontend) in development mode:

```bash
openmcp dev
```

Start only the backend service:

```bash
openmcp dev --service-only
```

Start only the frontend renderer:

```bash
openmcp dev --renderer-only
```

Specify a custom port for the service:

```bash
openmcp dev --port 9000
```

### Start production mode

```bash
openmcp start
```

### Check for updates

```bash
openmcp update --check
```

### Update to latest version

```bash
openmcp update
```

## Commands

| Command | Description |
|---------|-------------|
| `init [project-name]` | Initialize a new OpenMCP project |
| `dev [project-path]` | Start development servers (service + renderer) |
| `start [project-path]` | Start production servers |
| `update [project-path]` | Update project to the latest version |
| `-v, --version` | Display version number |
| `-h, --help` | Display help information |

## Project Structure

After initialization, your project will have the following structure:

```
my-project/
├── service/          # Backend service (Node.js + WebSocket)
│   ├── src/
│   └── package.json
├── renderer/         # Frontend UI (Vue 3 + Vite)
│   ├── src/
│   └── package.json
├── src/              # VSCode extension source
├── package.json      # Root package.json
└── ...
```

## Development Workflow

1. **Create a new project:**
   ```bash
   openmcp init my-project
   cd my-project
   ```

2. **Start development servers:**
   ```bash
   openmcp dev
   ```
   
   This will start:
   - Service (Backend) on port 8282
   - Renderer (Frontend) on port 5173 (Vite default)

3. **Open your browser:**
   
   Navigate to `http://localhost:5173` to access the OpenMCP interface.

4. **Make changes:**
   
   Both service and renderer support hot-reload during development.

## Troubleshooting

### Port already in use

If port 8282 is already in use, you can specify a different port:

```bash
openmcp dev --port 9000
```

### Permission denied on global install

If you encounter permission issues when installing globally:

```bash
# Option 1: Use npx (no global install needed)
npx openmcp-cli init my-project

# Option 2: Change npm's default directory
# See: https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally
```

### Git not found

Make sure Git is installed and available in your PATH:

```bash
git --version
```

## License

MIT

## Links

- [OpenMCP Documentation](https://openmcp.kirigaya.cn)
- [GitHub Repository](https://github.com/LSTM-Kirigaya/openmcpent)
