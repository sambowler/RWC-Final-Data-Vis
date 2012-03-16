<?php

require 'stemmer.inc';
ini_set('memory_limit', '2046M');

class Analyse {
    private $start_time;
    private $db;
    private $minutes = array();
    private $game_start_time;
    private $game_end_time;
    private $tweets = array();
    private $players;
    private $stemmer;
    private $stemmer_ignored_words = array();
    private $stopwords = array();
    private $words = array();
    private $total_team_1_tweets = 0;
    private $total_team_2_tweets = 0;

    function __construct($db_file, $game_start_time, $game_end_time, $events_json, $team_1, $team_2) {
        $start = microtime(true);
        $this->db = new PDO($db_file);

        $this->get_tweets_from_db();

        $this->game_start_time = strtotime($game_start_time);
        $this->game_end_time = strtotime($game_end_time);
        $this->events_json = $events_json;
        $this->team_1 = $team_1;
        $this->team_2 = $team_2;
        $this->players = array_merge($team_1['players'], $team_2['players']);
        $this->stemmer = new Stemmer();
        $this->analyse_stemmer_ignored_words();

        $this->words['nz'] = array();
        $this->words['fra'] = array();
        $this->analyse_stopwords();

        print "Processing events...\n";
        $this->process_events();
        print "Processed events.\nProcessing tweets...\n";
        $this->process_tweets();
        print "Processed data.\n";

        foreach($this->event_times as $min => $data) {
            $this->analyse_event_impact($min);
        }

        // Sort the array by key (in game minute)
        ksort($this->minutes);

        echo "Processed in: " . number_format((round(microtime(true) - $start)), 4) . " seconds\n";
    }

    public function get_stats() {
        $stats = array();

        $stats['total_nz_tweets'] = $this->total_team_1_tweets;
        $stats['total_fra_tweets'] = $this->total_team_2_tweets;

        return json_encode($stats);
    }

    public function get_events() {
        return json_encode($this->event_times);
    }
    
    public function get_minute($minute) {
        return json_encode($this->minutes[$minute]);
    }

    public function get_minute_data() {
        $minutes = array();

        foreach($this->minutes as $key => $minute) {
            unset($minute['tweets']);

            $minutes[$key] = $minute;

            $this->total_team_1_tweets += $minute['team_1_tweets'];
            $this->total_team_2_tweets += $minute['team_2_tweets'];
        }

        return json_encode($minutes);
    }

    public function get_words_data() {
        foreach($this->words as $team_key => $team) {
            $i = 50;

            while(count($this->words[$team_key]) > 100) {
                foreach($this->words[$team_key] as $key => $word) {
                    if($word < $i) { unset($this->words[$team_key][$key]); }
                }

                $i++;
            }

            arsort($team, SORT_NUMERIC);
        }

        return json_encode($this->words);
    }

    private function process_tweets() {
        $first_tweet = true;
        $previous_tweet_min = 0;
        $sentiment_this_min = 0;
        $team_1_tweets = 0;
        $team_2_tweets = 0;
        $tweets_this_min = array();

        foreach($this->tweets as $tweet) {
            $text = $tweet['text'];
            $created_at = strtotime($tweet['created_at']);
            $tweet_min = date('i', $created_at);
            $sentiment = $tweet['sentiment'];

            // If the tweet was created whilst the game was being played
            if($created_at >= $this->game_start_time && $created_at <= $this->game_end_time) {
                // Need to make sure we take in to account the first tweet
                if($first_tweet) {
                    $previous_tweet_min = $tweet_min;
                    $first_tweet = false;
                }

                $this_min_id = ($created_at - $this->game_start_time) / 60;

                // TODO: UPDATE
                // if($this_min_id >= $second_half_start) { $this_min_id -= $difference; }

                // TODO: Consult video to get actual minutes first half started at and second half started at
                if($this_min_id <= 40 || $this_min_id > 50) {
                    if($this_min_id > 50) { $this_min_id -= 10; }

                    if($tweet_min == $previous_tweet_min) {
                        // Don't store tweets relating to both teams
                        if($this->find_subject_team($text) != 'both') {
                            $tweets_this_min[] = array(
                                'user_name' => $tweet['user_name'], 
                                'tweet_id' => $tweet['id'], 
                                'text' => $text, 
                                'created_at' => $created_at, 
                                'sentiment' => $sentiment, 
                                'subject_team' => $this->find_subject_team($text),
                                'retweeted_status_id' => $tweet['retweeted_status_id']
                            );

                            if($this->find_subject_team($text) == 'nz') {
                                $team_1_tweets++;
                            } else {
                                $team_2_tweets++;
                            }

                            $this->analyse_words($text);
                        }
                    } else {
                        if(count($tweets_this_min) > 0) {
                            $this->minutes[$this_min_id] = array(
                                'minute_id' => $this_min_id,
                                'tweets' => $tweets_this_min,
                                // Sacrificing speed for legibility (lots of foreach loops through tweets)
                                'sentiment' => $this->analyse_sentiment($tweets_this_min),
                                'players' => $this->analyse_player_positivity($tweets_this_min),
                                'retweets' => $this->analyse_retweets($tweets_this_min),
                                'words' => $this->analyse_words_min($tweets_this_min),
                                'team_1_tweets' => $team_1_tweets,
                                'team_2_tweets' => $team_2_tweets,
                                //'event' => $this->analyse_events($tweets_this_min),
                                'tweet_count' => count($tweets_this_min)
                            );
                        }

                        $tweets_this_min = array();
                        $team_1_tweets = 0;
                        $team_2_tweets = 0;
                    }
                }

                $previous_tweet_min = $tweet_min;
            }
        }
    }

    private function analyse_event_impact($min) {
        $min_data = $this->minutes[$min];
        $t1_start = $min_data['sentiment']['team_1'];
        $t2_start = $min_data['sentiment']['team_2'];
        $t1 = array();
        $t2 = array();
        $comparison = 0;

        for($i = 1; $i <= 5; $i++) {
            $this_min = $min + $i;

            $this_min_data = $this->minutes[$this_min];
            $t1[] = $this_min_data['sentiment']['team_1'];
            $t2[] = $this_min_data['sentiment']['team_2'];

            if(array_key_exists($this_min, $this->event_times)) { break; }
        }

        $t1_average = round(array_sum($t1) / count($t1));
        $t2_average = round(array_sum($t2) / count($t2));

        $this->event_times[$min]->impact = array(
            'nz' => $t1_start - $t1_average,
            'fra' => $t1_start - $t2_average
        );
    }

    private function find_subject_team($text) {
        $team_1_terms = implode(',', array_merge($this->team_1['team'], $this->team_2['players']));
        $team_2_terms = implode(',', array_merge($this->team_2['team'], $this->team_2['players']));

        // The tweet contains data about team 1
        if($this->filter_tweet($text, $team_1_terms, $team_2_terms) && $this->filter_tweet($text, $team_2_terms, $team_1_terms)) {
            return 'both';
        } else if($this->filter_tweet($text, $team_1_terms, $team_2_terms)) {
            return 'nz';
        } else if($this->filter_tweet($text, $team_2_terms, $team_1_terms)) { // The tweet contains data about team 2
            return 'fra';
        }
    }

    private function analyse_retweets($tweets) {
        $retweets = array();

        foreach($tweets as $tweet) {
            if($tweet['retweeted_status_id']) {
                $retweeted_status_id = $tweet['retweeted_status_id'];

                array_key_exists($retweeted_status_id, $retweets) ? $retweets[$retweeted_status_id]++ : $retweets[$retweeted_status_id] = 1;
            }
        }

        arsort($retweets);

        return $retweets;
    }

    private function analyse_sentiment($tweets) {
        $team_1_terms = implode(',', array_merge($this->team_1['team'], $this->team_2['players']));
        $team_2_terms = implode(',', array_merge($this->team_2['team'], $this->team_2['players']));
        $team_1 = array(
            'tweets' => 0,
            'sentiment' => 0,
        );
        $team_2 = array(
            'tweets' => 0,
            'pos' => 0,
        );

        foreach($tweets as $tweet) {
            // The tweet contains data about team 1
            if($this->filter_tweet($tweet['text'], $team_1_terms, $team_2_terms) && $this->filter_tweet($tweet['text'], $team_2_terms, $team_1_terms)) {
                continue;
            } else if($this->filter_tweet($tweet['text'], $team_1_terms, $team_2_terms)) {
                if($tweet['sentiment'] == 'pos') { $team_1['pos']++; }
                $team_1['tweets']++;
            } else if($this->filter_tweet($tweet['text'], $team_2_terms, $team_1_terms)) { // The tweet contains data about team 2
                if($tweet['sentiment'] == 'pos') { $team_2['pos']++; }
                $team_2['tweets']++;
            }
        }

        if($team_1['tweets'] > 0) {
            $sentiment_team_1 = round(($team_1['pos'] / $team_1['tweets']) * 100);
        } else {
            $sentiment_team_1 = NULL;
        }

        if($team_2['tweets'] > 0) {
            $sentiment_team_2 = round(($team_2['pos'] / $team_2['tweets']) * 100);
        } else {
            $sentiment_team_2 = NULL;
        }

        return array(
            // Returns the positive percentage of tweets
            'team_1' => $sentiment_team_1,
            'team_2' => $sentiment_team_2
        );
    }

    private function analyse_player_positivity($tweets) {
        $ret = array();

        foreach($tweets as $tweet) {
            echo $tweet['text'] . "\n";

            foreach($this->players as $player) {
                $player = preg_replace('/\'/', '', $player);
                $player_name = preg_replace('/ /', '_', $player);

                $names = explode('_', $player_name);
                array_shift($names);
                $last_names = implode(' ', $names);

                if(stristr($tweet['text'], $last_names)) {
                    if(!isset($ret[$player_name])) {
                        $ret[$player_name] = array(
                            'pos' => 0,
                            'neg' => 0,
                            'tweets' => 0
                        );
                    }

                    ($tweet['sentiment'] == 'pos') ? $ret[$player_name]['pos']++ : $ret[$player_name]['neg']++;

                    $ret[$player_name]['tweets']++;
                }
            }
        }

        return $ret;
    }

    private function find_player_team($player_name) {
        if(in_array($player_name, $this->team_1['players'])) {
            return 'nz';
        } else if(in_array($player_name, $this->team_2['players'])) {
            return 'fra';
        }
    }

    private function analyse_words($text) {
        $this_tweet = $this->analyse_tweet_words($text);

        foreach($this_tweet as $team => $data) {
            foreach($data as $word => $count) {
                array_key_exists($word, $this->words[$team]) ? $this->words[$team][$word] += $count : $this->words[$team][$word] = $count;
            }
        }
    }

    private function analyse_words_min($tweets) {
        $ret = array(
            'nz' => array(),
            'fra' => array(),
        );

        foreach($tweets as $tweet) {
            $this_tweet = $this->analyse_tweet_words($tweet['text']);

            foreach($this_tweet as $team => $data) {
                foreach($data as $word => $count) {
                    array_key_exists($word, $ret[$team]) ? $ret[$team][$word] += $count : $ret[$team][$word] = $count;
                }
            }
        }

        return $ret;
    }

    private function analyse_tweet_words($text) {
        $ret = array('nz' => array(), 'fra' => array());
        $team = $this->find_subject_team($text) == 'nz' ? 'nz' : 'fra';
        $tokens = split(' ', $text);

        foreach($tokens as $token) {
            $first_char = substr($token, 0, 1);

            if($first_char != '@' && $first_char != '#') {
                $token = strtolower(preg_replace('/[^a-zA-Z0-9\s]/', '', $token));

                if(!in_array($token, $this->stemmer_ignored_words)) {
                    $token = $this->stemmer->stem($token);
                }

                if(!in_array($token, $this->stopwords) && strlen($token) >= 3) {
                    preg_match_all('/[a-zA-Z]/', $token, $matches);

                    if(count($matches[0]) > 1 && count($matches[0]) == strlen($token)) {
                        array_key_exists($token, $ret[$team]) ? $ret[$team][$token]++ : $ret[$team][$token] = 1;
                    }
                }
            }
        }

        return $ret;
    }

    private function process_events() {
        $game_start = new DateTime();
        $game_start->setTimestamp($this->game_start_time);
        $events = json_decode(file_get_contents($this->events_json));

        foreach($events as $min => $event) {
            $this->event_times[$min] = $event;
        }
    }

    private function filter_tweet($text, $containing, $not_containing = array()) {
        $containing = explode(',', $containing);
        $not_containing = explode(',', $not_containing);

        foreach($containing as $string) {
            if(stristr($text, $string)) { return true; }
        }

        foreach($not_containing as $string) {
            if(stristr($text, $string)) { return false; }
        }
    }

    private function get_tweets_from_db() {
        try {
            $tweets = $this->db->prepare('SELECT * FROM tweets;');
            $tweets->execute();
        } catch (Exception $e) {
            die($e);
        }

        $this->tweets = $tweets->fetchAll();
    }

    private function analyse_stopwords() {
        $fh = fopen('data_processing/stopwords.txt', 'r') or die("Couldn't find file");

        while($word = fgets($fh)) {
            $this->stopwords[] = trim($word);
        }

        fclose($fh);
    }

    private function analyse_stemmer_ignored_words() {
        $fh = fopen('data_processing/stemmer_ignored_words.txt', 'r') or die("Couldn't find file");

        while($word = fgets($fh)) {
            $this->stemmer_ignored_words[] = trim($word);
        }

        fclose($fh);
    }
}
