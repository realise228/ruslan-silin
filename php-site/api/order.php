<?php
header('Content-Type: application/json');
$mysqli = new mysqli('localhost', 'u3509947_default', 'h4tu4Y2BBjeXQTq2', 'u3509947_default');
$data = json_decode(file_get_contents('php://input'), true);
if (!empty($data['name']) && !empty($data['email']) && !empty($data['phone'])) {
  $stmt = $mysqli->prepare('INSERT INTO orders (name, email, phone) VALUES (?,?,?)');
  $stmt->bind_param('sss', $data['name'], $data['email'], $data['phone']);
  $stmt->execute();
  echo json_encode(['ok' => true]);
} else echo json_encode(['error' => 'all fields required']);
