# OnlyCat Integration for Homey

Homey integration for [OnlyCat](https://www.onlycat.com/) smart pet doors.

## Disclaimers
This app is an unofficial integration. I do not own or have any relation with onlycat, its brandname or its products.
Usage of this app is at your own risk. 

## Features

* 🏠 Know whether your pet is home or on the hunt using the Pet Presence sensor
* 🔎 Keep track of your device and build automations with it using sensors for:
   * 📶 Flap connection status
   * 🕒 Flap events (timestamp, RFID codes, trigger source, event classification)
   * 🐭 Contraband detection
   * 🔐 Lock state

## On the roadmap for later:    
* 🔄 Control your flap remotely using reboot and remote unlock options
* 🚪 Manage the active door policy manually or using automations
* 🐾 In case your pet chooses another exit, you can override the presence using the Set Pet Location action

## Flow Cards

### Triggers
- **Pet Detected**: Triggers when a pet is detected entering or exiting
- **Contraband Detected**: Triggers when contraband is detected by the device
- **Device (Dis)Connected**: Triggers when the device connects or disconnects

### Conditions
- **Pet is Home**: Check if a specific pet is currently at home
- **Device is Locked**: Check if the OnlyCat device is currently locked

### Actions
For now the app provides exclusively read only capabilities. 

## Installation / setup

### Install the app
1. Add OnlyCat from the homey app store
2. Open the OnlyCat app in Homey

### Retrieve your onlycat device token
1. Install and setup your onlycat flap with the onlycat app
2. Enable "Developer Mode" in the settings page
3. Write down your OnlyCat device token for later use when adding to homey

### Adding OnlyCat Devices
1. Go to Devices in the Homey app
2. Click the "+" button to add a new device
3. Select "OnlyCat Device"
4. Choose your device from the list
5. Complete the pairing process (You need to enter the device token, as retrieved by the steps above, here)

## Common Automation Ideas

* 🚨 Switch the door policy to "Locked" for a longer time period than usual when contraband is detected
* 💦 Deter intruders by triggering a sprinkler when an unknown RFID code is detected
* 🧹 Start your robot vacuum when your pet leaves the house
* 😻 Roll out the red carpet for your pet by activating welcome lights or triggering a feeder upon arrival
* 🔔 Send notifications when your pet comes home or leaves
* 🌡️ Monitor pet activity patterns and adjust home climate accordingly

## Capabilities

### OnlyCat Device
- **On/Off**: Lock/Unlock the device
- **Contact Alarm**: Door status (connected/disconnected)
- **Motion Alarm**: Motion detection
- **Presence**: Pet presence detection

### OnlyCat Pet
- **Presence**: Pet location (home/away)
- **Motion Alarm**: Pet activity detection

## Limitations

Currently, the following features of the OnlyCat app are not yet included in the Homey integration:

* Creating or modifying door policies
* Creating or modifying pet profiles (i.e., labels for RFID codes)
* Accessing the video or poster frame of flap events

## Troubleshooting

### Connection Issues
- Verify your device token is correct
- Check that your OnlyCat device is online

### Device Not Found
- Make sure your OnlyCat device is online in the OnlyCat app
- Try refreshing the device list

### Pet Not Detected
- Verify the pet's RFID tag is properly registered in the OnlyCat app
- Check that the pet has been detected by the device recently, using the app

## Contributing

Contributions are welcome! If you have ideas for new features & improvements or want to report a bug,
please open an issue or submit a pull request.

## License
This project is licensed under the MIT License - see the LICENSE file for details.



