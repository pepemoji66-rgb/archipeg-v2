<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit;
}

$servidor = "localhost";
$usuario = "root"; 
$pass = ""; 
// EL NOMBRE REAL DE TU BD (tal cual sale en tu phpMyAdmin)
$base_datos = "archipeg";

$conexion = new mysqli($servidor, $usuario, $pass, $base_datos);

if ($conexion->connect_error) {
    http_response_code(500);
    die(json_encode(["error" => "Conexión fallida"]));
}

$conexion->set_charset("utf8");

// Miramos si nos piden un año concreto por la URL (?anio=2024)
$anio = isset($_GET['anio']) ? (int)$_GET['anio'] : null;

if ($anio) {
    // Si hay año, filtramos en la base de datos (más rápido)
    $stmt = $conexion->prepare("SELECT id, titulo, descripcion, imagen_url, anio FROM fotos WHERE anio = ?");
    $stmt->bind_param("i", $anio);
    $stmt->execute();
    $resultado = $stmt->get_result();
} else {
    // Si no hay año, traemos todas
    $sql = "SELECT id, titulo, descripcion, imagen_url, anio FROM fotos";
    $resultado = $conexion->query($sql);
}

$fotos = [];

if ($resultado && $resultado->num_rows > 0) {
    while($fila = $resultado->fetch_assoc()) {
        $fotos[] = [
            "id" => (int)$fila['id'],
            "titulo" => $fila['titulo'],
            "descripcion" => $fila['descripcion'],
            "imagen_url" => $fila['imagen_url'],
            "anio" => (int)$fila['anio']
        ];
    }
}

echo json_encode($fotos);

if (isset($stmt)) $stmt->close();
$conexion->close();
?>