// Initialize Firebase
var config = {
    apiKey: "AIzaSyCtefDochSaFO7jHt62AtcSRItl7GlBBLc",
    authDomain: "rps-multiplayer-34c7f.firebaseapp.com",
    databaseURL: "https://rps-multiplayer-34c7f.firebaseio.com",
    storageBucket: "rps-multiplayer-34c7f.appspot.com",
    messagingSenderId: "151948833627"
};

firebase.initializeApp(config);

// Updatea players data everytime new data is received in Firebase
firebase.database().ref("players").on("value", function(snapshot) {
    let p1active = snapshot.child("1/name").exists();
    let p2active = snapshot.child("2/name").exists();

    // If Player 1 is in-game, show text
    if (p1active) {
        game.player1Name = snapshot.child("1/name").val();
        $("#name_p1").hide().html(snapshot.child("1/name").val()).fadeIn();
        $("#count_p1").hide().html("Wins: " + snapshot.child("1/wins").val() + " Losses: " + snapshot.child("1/losses").val()).fadeIn().removeClass("hide");
    }

    // If Player 2 is in-game, show text
    if (p2active) {
        game.player2Name = snapshot.child("2/name").val();
        $("#name_p2").hide().html(snapshot.child("2/name").val()).fadeIn();
        $("#count_p2").hide().html("Wins: " + snapshot.child("2/wins").val() + " Losses: " + snapshot.child("2/losses").val()).fadeIn().removeClass("hide");
    }

    // If both players present, start game (if it hasn't started already)
    if (p1active && p2active && !game.playersReady) {
        game.playersReady = true;
        game.playerTurn(1);
    }

    // Progress game as each choice is made (choice 2 calls getWinner(), and then players/winner exists which calls showWinner())
    if (snapshot.child("1/choice").exists()) { game.playerTurn(2); }
    if (snapshot.child("winner").exists()) { game.showWinner(); }

    // If neither player is connected: new game, clear chat
    if (!p1active && !p2active) {
        firebase.database().ref("chat").remove();
    }

    // console.log errors
}, function (errorObject) {
    console.log("The read failed: " + errorObject.code);
});


// Executes on data deletion/window exit/leave game
firebase.database().ref("players").on("child_removed", function(snapshot) {
    // If player disconnects, update game text, clear chat, show disconnected message, reset game state
    // Condition: if the removed object has key: "name"
    if (snapshot.val().name) {
        let otherPlayer = game.player == 1 ? 2 : 1;

        // If the current player has not been assigned, then look at win/loss visibility
        if (!game.player) { otherPlayer = $("#count_p1").css("visibility") == "hidden" ? 2 : 1; }

        // Update all game text (if needed)
        $("#name_p" + otherPlayer).hide().html("Waiting for Player " + otherPlayer).fadeIn();
        $("#count_p" + otherPlayer).addClass("hide");
        if ($("#game_status").html() != "") { $("#game_status").html("<h4>Waiting for other player to join.<h4>"); }
        $(".rps-p" + game.player).addClass("hide");

        // Delete chat log (new player incoming)
        firebase.database().ref("chat").remove();

        // Show player disconnected message in chatbox
        $("#chat").append("<span>Player " + otherPlayer + " has disconnected.</span><br/>");

        // Reset game state - not enough players
        game.playersReady = false;
    }

    // console.log errors
}, function (errorObject) {
    console.log("The read failed: " + errorObject.code);
});


// If chats are added
firebase.database().ref("chat").on("child_added", function(snapshot) {
    // color code each player's text
    // "Const" insures that the following constant will not be redefined - "scoped-blocked"
    const textColor = game.player == snapshot.val().player ? "blue" : "purple";
    $("#chat").append("<span style='color: " + textColor + "'>" + snapshot.val().text + "</span><br/>");
    
    // Scrolls chat window down automatically with each input
    let chat = document.getElementById("chat");
    chat.scrollTop = chat.scrollHeight;

// Log errors to console
}, function (errorObject) {
    console.log("The read failed: " + errorObject.code);
});

// Remove chat directions <label> on first chat send
$("#chat_send").on("click", function(){
    $("#chatDirections").fadeOut('fast');
});

// Game (object)
let game = {
    // Properties
    player: undefined,  // Player number (1 or 2)
    player1Name: undefined,
    player2Name: undefined,
    playersReady: false,  // If both players are present (playersReady: true), start game

    // Sets up text and buttons for current player's turn
    playerTurn : function(player){
        if (game.player == player) {
            // if it's your turn, show selection buttons and indicate it's your turn
            $("#game_status").html("<h4>It's your turn!<h4>");
            $(".rps-p" + game.player).removeClass("hide");
        } else {
            // If not your turn, hide selection buttons and indicate other player is choosing
            const otherPlayerName = game.player == 1 ? game.player2Name : game.player1Name;

            $("#game_status").html("<h4>It's " + otherPlayerName + "'s turn. Waiting...</h4>");
            $(".rps-p" + game.player).addClass("hide");
        }
    },

    // Determines and stores game winner
    getWinner: function(player2Choice){
        firebase.database().ref("players").once("value").then(function(snapshot){
            // On tie
            if (snapshot.child("1/choice").val() == player2Choice) {
                // Set winner to 0 (tie game)
                firebase.database().ref("players/winner").set("0");

            } // On player 1 win
            else if ((snapshot.child("1/choice").val() == "rock" && player2Choice == "scissors") || 
                (snapshot.child("1/choice").val() == "paper" && player2Choice == "rock") || 
                (snapshot.child("1/choice").val() == "scissors" && player2Choice == "paper")) {

                // Add to player 1 wins and player 2 losses
                firebase.database().ref("players/1/wins").transaction(function(currentWins) { return currentWins + 1; });
                firebase.database().ref("players/2/losses").transaction(function(currentLosses) { return currentLosses + 1; });

                // Set winner to 1 (player 1)
                firebase.database().ref("players/winner").set("1");

            } // On player 2 win
            else {
                // Add to player 2 wins and player 1 losses
                firebase.database().ref("players/2/wins").transaction(function(currentWins) { return currentWins + 1; });
                firebase.database().ref("players/1/losses").transaction(function(currentLosses) { return currentLosses + 1; });

                // Set winner to 2 (player 2)
                firebase.database().ref("players/winner").set("2");
            }
        });
    },

    // Shows game winner and starts next game
    showWinner: function(){
        firebase.database().ref("players").once("value").then(function(snapshot){
            // Show text on page depending on win/loss/tie
            switch (snapshot.child("winner").val()) {
                case "0": $("#winner").hide().html("<h2>It's a tie!</h2>").fadeIn(); break;
                case "1": $("#winner").hide().html("<h2>" + snapshot.child("1/name").val() + " wins!</h2>").fadeIn(); break;
                case "2": $("#winner").hide().html("<h2>" + snapshot.child("2/name").val() + " wins!</h2>").fadeIn(); break;
            }

            // Remove previous game data if still present
            if (snapshot.child("1/choice").exists()) { firebase.database().ref("players/1/choice").remove(); }
            if (snapshot.child("winner").exists()) { firebase.database().ref("players/winner").remove(); }
        
            setTimeout(resetGame, 2000);

            // Start game over
            function resetGame(){
                $("#winner").html("");
                game.playerTurn(1);
            }
        });
    }
};

$(function() {
    // Chooses player 1/2, set player name/wins/losses
    $("#submit").on("click", function(event){
        firebase.database().ref("players").once("value").then(function(snapshot){
            if (!snapshot.child("1/name").exists()) {
                game.player = 1;
            } else if (!snapshot.child("2/name").exists()) {
                game.player = 2;
            } else {
                $("#name_button").html("<h3>Sorry, game is full!</h3>");
            }

            const playerName = $("#name").val().trim();
            const loc = "players/" + game.player;

            // Only create player in database if player slot was available and a valid name was entered
            if (game.player && playerName != "") {
                firebase.database().ref(loc).set({
                    name: playerName,
                    wins: 0,
                    losses: 0
                });

                $("#name_button").hide().html("<h4>Hi " + playerName + "! You are Player " + game.player + "</h4>").fadeIn();

                // Only show if you are player 1 and you are not connecting to an existing game (there is no player 2)
                if (game.player == 1 && !snapshot.child("2/name").exists()) { $("#game_status").hide().html("<h4>Waiting for other player to join.<h4>").fadeIn(); }
            }
        });
    });
    // Allows name entry on enter
    $("#name").keypress(function(event) {
        if (event.which == 13) {
            $("#submit").click();
        }
    });

    // Enables chat only when both players are present
    $("#chat_send").on("click", function(event){
        if (game.playersReady && $("#chat_input").val().trim() != "") {
            const playerName = game.player == 1 ? game.player1Name : game.player2Name;
            
            firebase.database().ref("chat").push({
                text: playerName + ": " + $("#chat_input").val().trim(),
                player: game.player
            }).then(function(snapshot){  // Clear only the sender's chat_input, after the chat is sent
                $("#chat_input").val("");
            });
        }
    });
    // "enter" works in chat
    $("#chat_input").keypress(function(event) {
        if (event.which == 13) {
            $("#chat_send").click();
        }
    });

    // Determines rock/paper/scissors choice for player 1
    $(".rps-p1").on("click", function(event){
        firebase.database().ref("players/1/choice").set($(this).data("choice"));
    });

    // Determines rock/paper/scissors choice for player 2 and "gets the winner"
    $(".rps-p2").on("click", function(event){
        game.getWinner($(this).data("choice"));
    });
});

// Remove player's data on disconnect (cancel out of window)
$(window).on("beforeunload", function(event){
    firebase.database().ref("players/" + game.player).remove();
});

// Block email from spambots
var a = 'mikelearning91',
b = 'gmail.com',
c = 'Shoot me an <a hre' + 'f="mai' + 'lto:' + a + '@' + b + '">email</a>';
$('#email').append(c)