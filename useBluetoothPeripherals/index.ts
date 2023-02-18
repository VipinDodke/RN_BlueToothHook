import {PermissionsAndroid, Platform} from 'react-native';
import React, {useState} from 'react';
import {PERMISSIONS, requestMultiple} from 'react-native-permissions';
import deviceInfoModule from 'react-native-device-info';
import {
  BleError,
  BleManager,
  Characteristic,
  Device,
} from 'react-native-ble-plx';
import {atob, btoa} from 'react-native-quick-base64';

type VoidCallback = (result: boolean) => void;
const manager = new BleManager();
const SERVICE_UUID = ''; //@ Add uuid
const SERVICE_CHARACTERISTIC = ''; //@ Add uuid

interface BluetoothLowEnergyApi {
  requestPermissions(cb: VoidCallback): Promise<void>;
  scanForPeripherals(): void;
  connectToDevice: (deviceId: Device) => Promise<void>;
  disconnectFromDevice: () => void;
  connectedDevice: Device | null;
  allDevices: Device[];
  exchangeError: BleError | null;
  exchangeControl(
    device: Device,
    index: BigInt,
    operation: number,
  ): Promise<void>;
}

function useBluetoothPeripherals(): BluetoothLowEnergyApi {
  const [allDevices, setAllDevices] = useState<Device[]>([]);
  const [exchangeError, setExchangeError] = useState<BleError | null>(null);
  const requestPermissions = async (cb: VoidCallback) => {
    if (Platform.OS === 'android') {
      const apiLevel = await deviceInfoModule.getApiLevel();

      if (apiLevel < 31) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'Bluetooth Low Energy requires Location',
            buttonNeutral: 'Ask Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        cb(granted === PermissionsAndroid.RESULTS.GRANTED);
      } else {
        const result = await requestMultiple([
          PERMISSIONS.ANDROID.BLUETOOTH_SCAN,
          PERMISSIONS.ANDROID.BLUETOOTH_CONNECT,
          PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
        ]);

        const isGranted =
          result['android.permission.BLUETOOTH_CONNECT'] ===
            PermissionsAndroid.RESULTS.GRANTED &&
          result['android.permission.BLUETOOTH_SCAN'] ===
            PermissionsAndroid.RESULTS.GRANTED &&
          result['android.permission.ACCESS_FINE_LOCATION'] ===
            PermissionsAndroid.RESULTS.GRANTED;

        cb(isGranted);
      }
    } else {
      cb(true);
    }
  };
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const isDuplicateDevice = (devices: Device[], nextDevice: Device) =>
    devices.findIndex(device => nextDevice.localName === device.localName) > -1;

  const scanForPeripherals = () =>
    manager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.log(error);
        return;
      }
      if (device?.id) {
        /// Check device name
        setAllDevices((prevState: Device[]) => {
          if (!isDuplicateDevice(prevState, device)) {
            return [...prevState, device];
          }
          return prevState;
        });
      }
    });

  const connectToDevice = async (device: Device) => {
    try {
      const deviceConnection = await manager.connectToDevice(device.id);
      setConnectedDevice(deviceConnection);
      await deviceConnection.discoverAllServicesAndCharacteristics();
      manager.stopDeviceScan();
      startStreamingData(deviceConnection);
    } catch (e) {
      console.log('FAILED TO CONNECT', e);
    }
  };

  const disconnectFromDevice = () => {
    if (connectedDevice) {
      manager.cancelDeviceConnection(connectedDevice.id);
      setConnectedDevice(null);
    }
  };

  const startStreamingData = async (device: Device) => {
    if (device) {
      device.monitorCharacteristicForService(
        SERVICE_UUID,
        SERVICE_CHARACTERISTIC,
        onUpdated,
      );
    } else {
      console.log('No Device Connected');
    }
  };

  const onUpdated = (
    error: BleError | null,
    characteristic: Characteristic | null,
  ) => {
    if (error) {
      setExchangeError(error);
      return;
    }
    const rawData = atob(characteristic?.value ?? '');
    // @ deserializeData Function will come here
    // @ then filter
    // @our Data Ans...
  };

  const exchangeControl = async (
    device: Device,
    index: BigInt,
    operation: number,
  ) => {
    //@ Do preparation for send the data here {Data}
    let data = '';
    try {
      await manager.writeCharacteristicWithResponseForDevice(
        device.id,
        SERVICE_UUID,
        SERVICE_CHARACTERISTIC,
        btoa(`${data}`),
      );
    } catch (e) {
      console.log(e);
    }
  };

  return {
    exchangeControl,
    scanForPeripherals,
    requestPermissions,
    connectToDevice,
    allDevices,
    connectedDevice,
    disconnectFromDevice,
    //@ Remote commands will come here
    exchangeError,
  };
}

export default useBluetoothPeripherals;
