<?php
session_start();
$mysqli = new mysqli('localhost', 'u3509947_default', 'h4tu4Y2BBjeXQTq2', 'u3509947_default');
$mysqli->set_charset('utf8');

// Простая авторизация
if (isset($_POST['logout'])) { unset($_SESSION['admin']); header('Location: /admin'); exit; }
if (!empty($_POST['login']) && !empty($_POST['pass'])) {
  if ($_POST['login'] === 'ruslan505@yandex.ru' && $_POST['pass'] === 'Rus_Silin_505') {
    $_SESSION['admin'] = true;
  }
}
if (empty($_SESSION['admin'])) {
  echo '<html><body style="background:#0a0a0a;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh"><form method="post"><input name="login" placeholder="ЛОГИН" style="display:block;margin:10px;padding:10px"><input name="pass" type="password" placeholder="ПАРОЛЬ" style="display:block;margin:10px;padding:10px"><button style="padding:10px 30px;background:#c00;color:#fff;border:0;cursor:pointer">ВХОД</button></form></body></html>';
  exit;
}

// Обработка добавления
if ($_SERVER['REQUEST_METHOD'] === 'POST' && empty($_POST['logout'])) {
  $uploadDir = __DIR__ . '/../public/uploads/';
  if (!file_exists($uploadDir)) mkdir($uploadDir, 0777, true);
  
  if (isset($_POST['type']) && $_POST['type'] === 'track') {
    $title = $_POST['title'] ?? '';
    $desc = $_POST['description'] ?? '';
    $url = $_POST['url'] ?? '';
    $cover = '';
    if (!empty($_FILES['cover']['name'])) {
      $cover = time() . '-' . basename($_FILES['cover']['name']);
      move_uploaded_file($_FILES['cover']['tmp_name'], $uploadDir . $cover);
    }
    $stmt = $mysqli->prepare('INSERT INTO tracks (title, description, file, cover) VALUES (?,?,?,?)');
    $stmt->bind_param('ssss', $title, $desc, $url, $cover);
    $stmt->execute();
  }
  if (isset($_POST['type']) && $_POST['type'] === 'video') {
    $stmt = $mysqli->prepare('INSERT INTO videos (title, description, youtube_url) VALUES (?,?,?)');
    $stmt->bind_param('sss', $_POST['title'], $_POST['description'], $_POST['youtube_url']);
    $stmt->execute();
  }
  if (isset($_POST['type']) && $_POST['type'] === 'concert') {
    $banner = '';
    if (!empty($_FILES['banner']['name'])) {
      $banner = time() . '-' . basename($_FILES['banner']['name']);
      move_uploaded_file($_FILES['banner']['tmp_name'], $uploadDir . $banner);
    }
    $stmt = $mysqli->prepare('INSERT INTO concerts (city, venue, date, time, ticket_url, banner, description) VALUES (?,?,?,?,?,?,?)');
    $stmt->bind_param('sssssss', $_POST['city'], $_POST['venue'], $_POST['date'], $_POST['time'], $_POST['ticket_url'], $banner, $_POST['description']);
    $stmt->execute();
  }
  if (isset($_POST['type']) && $_POST['type'] === 'gallery') {
    $title = $_POST['title'] ?? '';
    $desc = $_POST['description'] ?? '';
    if (!empty($_FILES['image']['name'])) {
      $file = time() . '-' . basename($_FILES['image']['name']);
      move_uploaded_file($_FILES['image']['tmp_name'], $uploadDir . $file);
      $stmt = $mysqli->prepare('INSERT INTO gallery (title, description, file) VALUES (?,?,?)');
      $stmt->bind_param('sss', $title, $desc, $file);
      $stmt->execute();
    }
  }
  if (isset($_POST['type']) && $_POST['type'] === 'about') {
    $mysqli->query("INSERT INTO settings (`key`, value) VALUES ('about_text', '".$mysqli->real_escape_string($_POST['text'])."') ON DUPLICATE KEY UPDATE value='".$mysqli->real_escape_string($_POST['text'])."'");
  }
  if (isset($_POST['type']) && $_POST['type'] === 'design') {
    foreach (['accent','bg','text'] as $k) {
      $v = $mysqli->real_escape_string($_POST[$k] ?? '');
      $mysqli->query("INSERT INTO settings (`key`, value) VALUES ('$k', '$v') ON DUPLICATE KEY UPDATE value='$v'");
    }
  }
}

// Удаление
if (isset($_GET['delete']) && isset($_GET['id'])) {
  $tables = ['track'=>'tracks','video'=>'videos','concert'=>'concerts','gallery'=>'gallery','order'=>'orders'];
  if (isset($tables[$_GET['delete']])) {
    $mysqli->query("DELETE FROM {$tables[$_GET['delete']]} WHERE id=".intval($_GET['id']));
  }
  header('Location: /admin');
  exit;
}

$tracks = $mysqli->query("SELECT * FROM tracks ORDER BY created DESC")->fetch_all(MYSQLI_ASSOC);
$videos = $mysqli->query("SELECT * FROM videos ORDER BY created DESC")->fetch_all(MYSQLI_ASSOC);
$concerts = $mysqli->query("SELECT * FROM concerts ORDER BY date ASC")->fetch_all(MYSQLI_ASSOC);
$gallery = $mysqli->query("SELECT * FROM gallery ORDER BY created DESC")->fetch_all(MYSQLI_ASSOC);
$orders = $mysqli->query("SELECT * FROM orders ORDER BY created DESC")->fetch_all(MYSQLI_ASSOC);
$settings = $mysqli->query("SELECT * FROM settings")->fetch_all(MYSQLI_ASSOC);
$settings = array_column($settings, 'value', 'key');
?>
<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"><title>АДМИН</title><style>
body{background:#0a0a0a;color:#fff;font-family:Oswald,sans-serif;padding:30px;text-transform:uppercase}h1{color:#c00}table{width:100%;border-collapse:collapse;margin:20px 0}th,td{padding:10px;border-bottom:1px solid #1a1a1a;text-align:left}th{color:#c00}form{background:#111;padding:20px;margin:20px 0;max-width:500px}input,textarea,button{display:block;width:100%;padding:10px;margin:10px 0;background:#1a1a1a;border:1px solid #333;color:#fff}button{background:#c00;border:0;cursor:pointer}.btn-del{background:#a00;color:#fff;padding:5px 10px;text-decoration:none;font-size:11px}.tab{display:inline-block;padding:10px 15px;background:#111;border:1px solid #333;cursor:pointer;margin-right:5px}.tab.active{background:#c00}
</style></head><body>
<h1>АДМИН</h1>
<div>
  <span class="tab active" onclick="showTab('add')">ДОБАВИТЬ</span>
  <span class="tab" onclick="showTab('tracks')">ТРЕКИ</span>
  <span class="tab" onclick="showTab('videos')">ВИДЕО</span>
  <span class="tab" onclick="showTab('concerts')">МЕРОПРИЯТИЯ</span>
  <span class="tab" onclick="showTab('gallery')">ГАЛЕРЕЯ</span>
  <span class="tab" onclick="showTab('orders')">ЗАЯВКИ</span>
  <span class="tab" onclick="showTab('about')">ОБ АРТИСТЕ</span>
  <span class="tab" onclick="showTab('design')">ДИЗАЙН</span>
</div>
<div id="tab-add" class="tab-content">
  <form method="post" enctype="multipart/form-data"><input type="hidden" name="type" value="track"><h2>ТРЕК</h2><input name="title" placeholder="НАЗВАНИЕ" required><textarea name="description" placeholder="ОПИСАНИЕ"></textarea><input name="url" placeholder="ССЫЛКА" required><input type="file" name="cover"><button>ДОБАВИТЬ</button></form>
  <form method="post"><input type="hidden" name="type" value="video"><h2>ВИДЕО</h2><input name="title" placeholder="НАЗВАНИЕ" required><textarea name="description" placeholder="ОПИСАНИЕ"></textarea><input name="youtube_url" placeholder="ССЫЛКА YOUTUBE" required><button>ДОБАВИТЬ</button></form>
  <form method="post" enctype="multipart/form-data"><input type="hidden" name="type" value="concert"><h2>МЕРОПРИЯТИЕ</h2><input name="city" placeholder="ГОРОД" required><input name="venue" placeholder="ПЛОЩАДКА"><input name="date" placeholder="ДАТА" required><input name="time" placeholder="ВРЕМЯ"><input name="ticket_url" placeholder="ССЫЛКА"><input type="file" name="banner"><textarea name="description" placeholder="ОПИСАНИЕ"></textarea><button>ДОБАВИТЬ</button></form>
  <form method="post" enctype="multipart/form-data"><input type="hidden" name="type" value="gallery"><h2>ГАЛЕРЕЯ</h2><input name="title" placeholder="ЗАГОЛОВОК"><input type="file" name="image" required><button>ДОБАВИТЬ</button></form>
</div>
<div id="tab-tracks" class="tab-content" style="display:none"><h2>ТРЕКИ</h2><table><tr><th>НАЗВАНИЕ</th><th>ССЫЛКА</th><th></th></tr><?php foreach($tracks as $t):?><tr><td><?=$t['title']?></td><td><a href="<?=$t['file']?>" target="_blank">ОТКРЫТЬ</a></td><td><a href="?delete=track&id=<?=$t['id']?>" class="btn-del">УДАЛИТЬ</a></td></tr><?php endforeach;?></table></div>
<div id="tab-videos" class="tab-content" style="display:none"><h2>ВИДЕО</h2><table><tr><th>НАЗВАНИЕ</th><th>ССЫЛКА</th><th></th></tr><?php foreach($videos as $v):?><tr><td><?=$v['title']?></td><td><a href="<?=$v['youtube_url']?>" target="_blank">ОТКРЫТЬ</a></td><td><a href="?delete=video&id=<?=$v['id']?>" class="btn-del">УДАЛИТЬ</a></td></tr><?php endforeach;?></table></div>
<div id="tab-concerts" class="tab-content" style="display:none"><h2>МЕРОПРИЯТИЯ</h2><table><tr><th>ДАТА</th><th>ГОРОД</th><th></th></tr><?php foreach($concerts as $c):?><tr><td><?=$c['date']?> <?=$c['time']?></td><td><?=$c['city']?></td><td><a href="?delete=concert&id=<?=$c['id']?>" class="btn-del">УДАЛИТЬ</a></td></tr><?php endforeach;?></table></div>
<div id="tab-gallery" class="tab-content" style="display:none"><h2>ГАЛЕРЕЯ</h2><div style="display:flex;gap:10px;flex-wrap:wrap"><?php foreach($gallery as $g):?><div><img src="/uploads/<?=$g['file']?>" style="width:150px;height:150px;object-fit:cover"><br><a href="?delete=gallery&id=<?=$g['id']?>" class="btn-del">УДАЛИТЬ</a></div><?php endforeach;?></div></div>
<div id="tab-orders" class="tab-content" style="display:none"><h2>ЗАЯВКИ</h2><table><tr><th>ДАТА</th><th>ИМЯ</th><th>EMAIL</th><th>ТЕЛЕФОН</th><th></th></tr><?php foreach($orders as $o):?><tr><td><?=$o['created']?></td><td><?=$o['name']?></td><td><?=$o['email']?></td><td><?=$o['phone']?></td><td><a href="?delete=order&id=<?=$o['id']?>" class="btn-del">УДАЛИТЬ</a></td></tr><?php endforeach;?></table></div>
<div id="tab-about" class="tab-content" style="display:none"><h2>ТЕКСТ</h2><form method="post"><input type="hidden" name="type" value="about"><textarea name="text" rows="10"><?=htmlspecialchars($settings['about_text']??'')?></textarea><button>СОХРАНИТЬ</button></form></div>
<div id="tab-design" class="tab-content" style="display:none"><h2>ДИЗАЙН</h2><form method="post"><input type="hidden" name="type" value="design"><label>АКЦЕНТ</label><input type="color" name="accent" value="<?=$settings['accent']??'#cc0000'?>"><label>ФОН</label><input type="color" name="bg" value="<?=$settings['bg']??'#000000'?>"><label>ТЕКСТ</label><input type="color" name="text" value="<?=$settings['text']??'#ffffff'?>"><button>ПРИМЕНИТЬ</button></form></div>
<form method="post" style="text-align:center;margin-top:40px"><input type="hidden" name="logout" value="1"><button style="width:auto;padding:10px 30px">ВЫХОД</button></form>
<a href="/" style="color:#666;display:block;text-align:center;margin-top:20px">НА САЙТ</a>
<script>
function showTab(n){
  document.querySelectorAll('.tab-content').forEach(function(c){c.style.display='none'});
  document.querySelectorAll('.tab').forEach(function(t){t.classList.remove('active')});
  document.getElementById('tab-'+n).style.display='block';
  event.target.classList.add('active');
}
</script>
</body></html>
