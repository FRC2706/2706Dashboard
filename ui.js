// Define UI elements
let ui = {
    timer: document.getElementById('timer'),
    robotState: document.getElementById('robot-state').firstChild,
    robotStateBox: document.getElementById('robot-state'),
    gyro: {
        container: document.getElementById('gyro'),
        val: 0,
        offset: 0,
        visualVal: 0,
        arm: document.getElementById('gyro-arm'),
        number: document.getElementById('gyro-number')
    },
    robotDiagram: {
        arm: document.getElementById('robot-arm')
    },
    tuning: {
        list: document.getElementById('tuning'),
        button: document.getElementById('tuning-button'),
        name: document.getElementById('name'),
        value: document.getElementById('value'),
        set: document.getElementById('set'),
        get: document.getElementById('get')
    },
    autoSelectList: document.getElementById("autoselector"),
};
let address = document.getElementById('connect-address'),
    connect = document.getElementById('connectButton')

// Sets function to be called on NetworkTables connect. Commented out because it's usually not necessary.
// NetworkTables.addWsConnectionListener(onNetworkTablesConnection, true);

// Sets function to be called when robot dis/connects
NetworkTables.addRobotConnectionListener(onRobotConnection, false);

// Sets function to be called when any NetworkTables key/value changes
NetworkTables.addGlobalListener(onValueChanged, true);

let escCount = 0;
onkeydown = key => {
    if (key.key === 'Escape') {
        setTimeout(() => { escCount = 0; }, 400);
        escCount++;
        console.log(escCount);
        if (escCount === 2) {
            document.body.classList.toggle('login-close', true);
        }
    }
    else
        console.log(key.key);
};
if (noElectron) {
    document.body.classList.add('login-close');
}

const CONNECTED_TEXT = "CONNECTED";
const DISCONNECTED_TEXT = "DISCONNECTED";
function onRobotConnection(connected) {
    var state = connected ? CONNECTED_TEXT : DISCONNECTED_TEXT;
    console.log(state);
    ui.robotState.data = state;
    if (state === CONNECTED_TEXT) ui.robotStateBox.style.color = "green";
    else ui.robotStateBox.style.color = "red";
    if (!noElectron) {
        if (connected) {
            // On connect hide the connect popup
            document.body.classList.toggle('login-close', true);

            console.log("Connected.") // TODO remove
            var gyroReader = NetworkTables.getValue('/SmartDashboard/Gyro', "Received no value");
            console.log("GYRO : " + gyroReader);
            console.log(NetworkTables);
        }
        else {
            // On disconnect show the connect popup
            document.body.classList.toggle('login-close', false);
            // Add Enter key handler
            address.onkeydown = ev => {
                if (ev.key === 'Enter') {
                    connect.click();
                }
            };
            // Enable the input and the button
            address.disabled = false;
            connect.disabled = false;
            connect.firstChild.data = 'Connect';
            // Add the default address and select xxxx
            address.value = 'roboRIO-2706-FRC.local';
            address.focus();
            address.setSelectionRange(8, 12);
            // On click try to connect and disable the input and the button
            connect.onclick = () => {
                console.log(address.value);
                ipc.send('connect', address.value);
                address.disabled = true;
                connect.disabled = true;
                connect.firstChild.data = 'Connecting';
                console.log("Connecting");
            };
        }
    }
}

/**** KEY Listeners ****/

// Gyro rotation
let updateGyro = (key, value) => {
    ui.gyro.val = value;
    ui.gyro.visualVal = Math.floor(ui.gyro.val - ui.gyro.offset);
    if (ui.gyro.visualVal < 0) {
        ui.gyro.visualVal += 360;
    }
    ui.gyro.arm.style.transform = `rotate(${ui.gyro.visualVal}deg)`;
    ui.gyro.number.innerHTML = ui.gyro.visualVal + 'º';
};
NetworkTables.addKeyListener('/SmartDashboard/Gyro', updateGyro);

// The following case is an example, for a robot with an arm at the front.
// Info on the actual robot that this works with can be seen at thebluealliance.com/team/1418/2016.
NetworkTables.addKeyListener('/SmartDashboard/arm/encoder', (key, value) => {
    // 0 is all the way back, 1200 is 45 degrees forward. We don't want it going past that.
    if (value > 1140) {
        value = 1140;
    }
    else if (value < 0) {
        value = 0;
    }
    // Calculate visual rotation of arm
    var armAngle = value * 3 / 20 - 45;
    // Rotate the arm in diagram to match real arm
    ui.robotDiagram.arm.style.transform = `rotate(${armAngle}deg)`;
});

var GTimer;
NetworkTables.addKeyListener('/SmartDashboard/time_running', (key, value) => {
    // Sometimes, NetworkTables will pass booleans as strings. This corrects for that.
    if (typeof value === 'string')
        value = (value === 'true');
    // When this NetworkTables variable is true, the timer will start.
    // You shouldn't need to touch this code, but it's documented anyway in case you do.
    var s = 135, timer_label = document.getElementById("timer_subtitle");
    if (value) {
        // Function below adjusts time left every second
        GTimer = setInterval(function () {
            s--; // Subtract one second
            // Minutes (m) is equal to the total seconds divided by sixty with the decimal removed.
            var m = Math.floor(s / 60);
            // Create seconds number that will actually be displayed after minutes are subtracted
            var visualS = (s % 60);
            // Add leading zero if seconds is one digit long, for proper time formatting.
            visualS = visualS < 10 ? '0' + visualS : visualS;
            if (s < 0) {
                // Stop GTimer when timer reaches zero
                clearTimeout(GTimer);
                timer_label.innerHTML = "POST GAME";
                GTimer = null;
                ui.timer.style.animationPlayState = "paused";
                ui.timer.style.font.color = "#ff3030";
                return;
            }
            else if (s <= 30) {
                // Flash timer if less than 30 seconds left
                ui.timer.style.animationPlayState = "running";
            }

            ui.timer.firstChild.data = m + ':' + visualS;

            // Autonomous period
            if (s >= 120) {
                timer_label.innerHTML = "AUTONOMOUS";
            }
            // Teleop
            else if (s > 30) {
                timer_label.innerHTML = "TELEOP";
            }
            // Climb period
            else {
                timer_label.innerHTML = "CLIMB";
            }
        }, 1000);
    }
    else {
        s = 135;
        var m = Math.floor(s / 60), visualS = s % 60;
        if (GTimer != null) {
            clearTimeout(GTimer);
            GTimer = null;
            ui.timer.firstChild.data = m + ":" + visualS;
            timer_label.innerHTML = "NO PERIOD";
        }
    }
});

// Listen and respond to posted autonomous modes
NetworkTables.addKeyListener('/SmartDashboard/autonomous/auto_modes', (key, stringDictionary) => {
    console.log("Auto Modes Received. Decoding...");
    var autoModes = JSON.parse(stringDictionary);
    console.log("Received Autonomous Modes : " + autoModes);

    var autoModesListItems = "";
    for (var autoModeKey in autoModes) {
        autoModesListItems += "<li id = \"" + autoModeKey + "\" draggable = \"true\" class = \"automode\">" + autoModes[autoModeKey] + "</li>";
    }

    ui.autoSelectList.innerHTML = autoModesListItems;

    refreshAutoDragAndDrop();

    sendAutoModes();
});

var selectedAutoModesKey = "/SmartDashboard/autonomous/selected_modes";
function sendAutoModes() {
    var jsonObject = getTopAutoModes();
    if (jsonObject == null) return;

    NetworkTables.putValue(selectedAutoModesKey, jsonObject);
}

function getSelectedStartPos() {
    var left = document.getElementById("l_side"), centre = document.getElementById("c_side"), right = document.getElementById("r_side");
    if (left.checked) return left.value;
    else if (centre.checked) return centre.value;
    else if (right.checked) return right.value;
}

const sideSelectLocation = "/SmartDashboard/autonomous/selected_position";
function updateSelectedSide() {
    var selectedSide = getSelectedStartPos();
    console.log("Sending selected side to " + sideSelectLocation + " : " + selectedSide);
    NetworkTables.putValue(sideSelectLocation, selectedSide);

    // TODO remove
    var side = NetworkTables.getValue(sideSelectLocation);
    console.log("Receiving selected side back : " + side);
}

function getTopAutoModes() {
    var elementChildren = ui.autoSelectList.children;
    var topThreeAutoModes = [];

    if (elementChildren.length == 0) return null;
    topThreeAutoModes[0] = elementChildren[0].id;
    if (elementChildren.length > 1) topThreeAutoModes[1] = elementChildren[1].id;
    if (elementChildren.length > 2) topThreeAutoModes[2] = elementChildren[2].id;

    return JSON.stringify(topThreeAutoModes);
}



// Global Listener
function onValueChanged(key, value, isNew) {
    // Sometimes, NetworkTables will pass booleans as strings. This corrects for that.
    if (value == 'true') {
        value = true;
    }
    else if (value == 'false') {
        value = false;
    }
    // The following code manages tuning section of the interface.
    // This section displays a list of all NetworkTables variables (that start with /SmartDashboard/) and allows you to directly manipulate them.
    var propName = key.substring(16, key.length);
    // Check if value is new and doesn't have a spot on the list yet
    if (isNew && !document.getElementsByName(propName)[0]) {
        // Make sure name starts with /SmartDashboard/. Properties that don't are technical and don't need to be shown on the list.
        if (/^\/SmartDashboard\//.test(key)) {
            // Make a new div for this value
            var div = document.createElement('div'); // Make div
            ui.tuning.list.appendChild(div); // Add the div to the page
            var p = document.createElement('p'); // Make a <p> to display the name of the property
            p.appendChild(document.createTextNode(propName)); // Make content of <p> have the name of the NetworkTables value
            div.appendChild(p); // Put <p> in div
            var input = document.createElement('input'); // Create input
            input.name = propName; // Make its name property be the name of the NetworkTables value
            input.value = value; // Set
            // The following statement figures out which data type the variable is.
            // If it's a boolean, it will make the input be a checkbox. If it's a number,
            // it will make it a number chooser with up and down arrows in the box. Otherwise, it will make it a textbox.
            if (typeof value === 'boolean') {
                input.type = 'checkbox';
                input.checked = value; // value property doesn't work on checkboxes, we'll need to use the checked property instead
                input.onchange = function () {
                    // For booleans, send bool of whether or not checkbox is checked
                    NetworkTables.putValue(key, this.checked);
                };
            }
            else if (!isNaN(value)) {
                input.type = 'number';
                input.onchange = function () {
                    // For number values, send value of input as an int.
                    NetworkTables.putValue(key, parseInt(this.value));
                };
            }
            else {
                input.type = 'text';
                input.onchange = function () {
                    // For normal text values, just send the value.
                    NetworkTables.putValue(key, this.value);
                };
            }
            // Put the input into the div.
            div.appendChild(input);
        }
    }
    else {
        // Find already-existing input for changing this variable
        var oldInput = document.getElementsByName(propName)[0];
        if (oldInput) {
            if (oldInput.type === 'checkbox') {
                oldInput.checked = value;
            }
            else {
                oldInput.value = value;
            }
        }
        else {
            // console.log('Error: Non-new variable ' + key + ' not present in tuning list!');
            // TODO figure out why this happens and stuff.
        }
    }
}

// Reset gyro value to 0 on click
ui.gyro.container.onclick = function () {
    // Store previous gyro val, will now be subtracted from val for callibration
    ui.gyro.offset = ui.gyro.val;
    // Trigger the gyro to recalculate value.
    updateGyro('/SmartDashboard/drive/navx/yaw', ui.gyro.val);
};
// Open tuning section when button is clicked
ui.tuning.button.onclick = function () {
    if (ui.tuning.list.style.display === 'none') {
        ui.tuning.list.style.display = 'block';
    }
    else {
        ui.tuning.list.style.display = 'none';
    }
};
// Manages get and set buttons at the top of the tuning pane
ui.tuning.set.onclick = function () {
    // Make sure the inputs have content, if they do update the NT value
    if (ui.tuning.name.value && ui.tuning.value.value) {
        NetworkTables.putValue('/SmartDashboard/' + ui.tuning.name.value, ui.tuning.value.value);
    }
};
ui.tuning.get.onclick = function () {
    ui.tuning.value.value = NetworkTables.getValue(ui.tuning.name.value);
};

// Set some of the autonomous mode ids
var exchangeId = 0, driveId = 1, scaleId = 2, switchId = 3;
var takenPriorities = [], buttons = {};

function autonomousSelected(autoModeKey) {
  var element = document.getElementById(autoModeKey);

  // If the key doesn't exist in the buttons dictionary, add it with no priority.
  if (!(autoModeKey in buttons)) {
    buttons[autoModeKey] = 0;
  }

  var priority = buttons[autoModeKey];
  var newPriority = priority;

  do {
    // If the priority gets all the way to 3 and no new priority is found, reset back to 1.
    if (newPriority === 3) {
      newPriority = 0;
      removeFromTakenPriorities(priority);
      break;
    }
    // Increase the priority level until we find one that's not taken
    newPriority++;

    //var notInNewPriorities = (takenPriorities.findIndex(function(input) { return newPriority === input }) == -1)
    var notInNewPriorities = takenPriorities.indexOf(newPriority) === -1;

    if (notInNewPriorities) {
      removeFromTakenPriorities(priority);
      takenPriorities.push(newPriority);
      buttons[autoModeKey] = newPriority;
      break;
    }
  }
  while(newPriority != 0);

  buttons[autoModeKey] = newPriority;

  var currentButtonText = element.innerHTML;

  // Select from the second index onwards, to avoid number
  if (priority != 0) currentButtonText = currentButtonText.substring(2);

  // Put no number if the new priority is 0.
  if (newPriority != 0) currentButtonText = newPriority + ". " + currentButtonText;

  element.innerHTML = currentButtonText;
}

function removeFromTakenPriorities(elementToRemove) {
        var indexOfOldPriority = takenPriorities.indexOf(elementToRemove);
        if (indexOfOldPriority > -1) takenPriorities.splice(indexOfOldPriority, 1);
}
