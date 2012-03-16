<?php

ini_set('memory_limit', '2046M');
date_default_timezone_set('UTC');

require('analyse_data.php');

function write_to_file($filename, $data) {
    $fh = fopen($filename, 'w');
    fwrite($fh, $data);
    fclose($fh);
}

$game_start_time = 'Sun Oct 23 08:00:00 +0000 2011';
$game_end_time = 'Sun Oct 23 09:30:00 +0000 2011';

$team_1 = array(
    'team' => array('new zealand', 'all blacks', 'kiwi', 'nouvelle zélande', 'tous noirs'),
    'players' => array('israel dagg', 'cory jane', 'conrad smith', 'ma\'a nonu', 'richard kahui', 'aaron cruden', 'piri weepu', 'kieran read', 'richie mccaw', 'jerome kaino', 'sam whitelock', 'brad thorn', 'owen franks', 'keven mealamu', 'tony woodcock', 'andrew hore', 'ben franks', 'ali williams', 'adam thomson', 'andy ellis', 'stephen donald', 'sonny bill williams')
);
$team_2 = array(
    'team' => array('france', 'francais', 'french', 'les bleus'),
    'players' => array('maxime medard', 'vincent clerc', 'aurelien rougerie', 'maxime mermoz', 'alexis palisson', 'morgan parra', 'dimitri yachvili', 'imanol harinordoquy', 'julien bonnaire', 'thierry dusautoir', 'lionel nallet', 'pascal pape', 'nicolas mas', 'william servat', 'jean-baptiste poux', 'dimitri szarzewski', 'fabien barcella', 'julien pierre', 'fulgence ouedraogo', 'jean-marc doussain', 'francois trinh-duc', 'damien traille')
);

$analyse = new Analyse('sqlite:/Users/sambowler/Dropbox/Uni/Year 3/Digital Media Project/Project/final.sqlite', $game_start_time, $game_end_time, '/Users/sambowler/Dropbox/Uni/Year 3/Digital Media Project/Project/final_events.json', $team_1, $team_2);

for($i = 0; $i <= 80; $i++) {
    write_to_file('data/minutes/' . $i . '.json', $analyse->get_minute($i));
}

write_to_file('data/minutes.json', $analyse->get_minute_data());
write_to_file('data/words.json', $analyse->get_words_data());
write_to_file('data/stats.json', $analyse->get_stats());
//write_to_file('data/events.json', $analyse->get_events());
