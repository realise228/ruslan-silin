<?php
header('Content-Type: application/json');
$mysqli = new mysqli('localhost', 'u3509947_default', 'h4tu4Y2BBjeXQTq2', 'u3509947_default');
$data = json_decode(file_get_contents('php://input'), true);
if (!empty($data['email'])) {
  $stmt = $mysqli->prepare('INSERT IGNORE INTO subscribers (email) VALUES (?)');
  $stmt->bind_param('s', $data['email']);
  $stmt->execute();
  echo json_encode(['ok' => true]);
} else echo json_encode(['error' => 'email required']);
