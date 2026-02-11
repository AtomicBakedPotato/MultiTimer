import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Alert } from 'react-native';

export const pickAndSaveAudio = async () => {
    try {
        const result = await DocumentPicker.getDocumentAsync({
            type: 'audio/*',
            copyToCacheDirectory: true,
        });

        if (result.canceled || !result.assets || result.assets.length === 0) {
            return null;
        }

        const asset = result.assets[0];
        const fileName = asset.name;
        const fileUri = asset.uri;

        // Create a persistent destination path
        const directory = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}sounds/` : `${FileSystem.cacheDirectory}sounds/`;
        const destination = `${directory}${Date.now()}_${fileName}`;

        // Ensure directory exists
        const dirInfo = await FileSystem.getInfoAsync(directory);
        if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
        }

        // Copy file to persistent storage
        await FileSystem.copyAsync({
            from: fileUri,
            to: destination,
        });

        return {
            uri: destination,
            name: fileName,
        };
    } catch (error) {
        console.error('Error picking audio:', error);
        Alert.alert('Error', 'Failed to pick or save audio file.');
        return null;
    }
};
