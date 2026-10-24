import {
    Box,
    Button,
    ButtonText,
    HStack,
    Input,
    InputField,
    Pressable,
    ScrollView,
    Text,
    VStack,
} from '@gluestack-ui/themed';
import { Pencil, Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Image, Modal, StyleSheet, View } from 'react-native';

import {
    addPublicKey,
    deletePublicKey,
    getPublicKeys,
    initDatabase,
    updatePublicKey,
} from '@/core/db';
import { PublicKeyRecord } from '@/core/types';

const BLACK = '#07111d';
const PANEL = '#0f172a';
const YELLOW = '#facc15';
const MUTED = '#cbd5e1';

export default function SettingsPage() {
  const [publicKeys, setPublicKeys] = useState<PublicKeyRecord[]>([]);
  const [keyName, setKeyName] = useState('');
  const [keyValue, setKeyValue] = useState('');
  const [editingKey, setEditingKey] = useState<PublicKeyRecord | null>(null);
  const [editName, setEditName] = useState('');
  const [editValue, setEditValue] = useState('');

  const refresh = async () => {
    await initDatabase();
    setPublicKeys(await getPublicKeys());
  };

  useEffect(() => {
    refresh();
  }, []);

  const saveKey = async () => {
    if (!keyName.trim() || !keyValue.trim()) return;
    await addPublicKey(keyName.trim(), keyValue.trim());
    setKeyName('');
    setKeyValue('');
    await refresh();
  };

  const startEdit = (item: PublicKeyRecord) => {
    setEditingKey(item);
    setEditName(item.name);
    setEditValue(item.public_key_string);
  };

  const saveEdit = async () => {
    if (!editingKey || !editName.trim() || !editValue.trim()) return;
    await updatePublicKey(editingKey.id, editName.trim(), editValue.trim());
    setEditingKey(null);
    await refresh();
  };

  const confirmDelete = (item: PublicKeyRecord) => {
    Alert.alert('Delete public key?', `“${item.name}” will be removed from this device.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deletePublicKey(item.id).then(refresh);
        },
      },
    ]);
  };

  return (
    <ScrollView bg={BLACK} flex={1}>
      <Box px="$4" py="$6">
        <VStack space="lg">
          <HStack alignItems="center" space="sm">
            <Image
              source={require('../assets/msi_white.png')}
              style={{ width: 46, height: 40 }}
              resizeMode="contain"
              accessibilityLabel="VeriFlow logo"
            />
            <Text color={YELLOW} fontSize="$3xl" fontWeight="900">
              Settings
            </Text>
          </HStack>

          <Box borderWidth={2} borderColor={YELLOW} borderRadius="$xl" bg={PANEL} p="$4">
            <HStack justifyContent="space-between" alignItems="center" mb="$4">
              <Text color="#f8fafc" fontSize="$xl" fontWeight="800">
                Key Manager
              </Text>
              <Text color={MUTED} fontSize="$xs">
                {publicKeys.length} {publicKeys.length === 1 ? 'key' : 'keys'}
              </Text>
            </HStack>

            <VStack space="sm">
              <Input variant="outline" size="lg" borderColor="#334155">
                <InputField
                  value={keyName}
                  onChangeText={setKeyName}
                  placeholder="Key name"
                  placeholderTextColor="#94a3b8"
                  color="#f8fafc"
                />
              </Input>

              <Input variant="outline" size="lg" borderColor="#334155">
                <InputField
                  value={keyValue}
                  onChangeText={setKeyValue}
                  placeholder="Public key PEM"
                  placeholderTextColor="#94a3b8"
                  color="#f8fafc"
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                  minHeight={120}
                />
              </Input>

              <Button bg={YELLOW} borderRadius="$lg" onPress={saveKey}>
                <ButtonText color={BLACK} fontWeight="900">
                  Add Key
                </ButtonText>
              </Button>
            </VStack>

            <VStack mt="$5" space="sm">
              <HStack
                alignItems="center"
                borderBottomWidth={1}
                borderBottomColor="#334155"
                pb="$2"
                px="$2"
              >
                <Text color={MUTED} fontSize="$xs" fontWeight="800" flex={1}>
                  KEY
                </Text>
                <Text color={MUTED} fontSize="$xs" fontWeight="800" textAlign="right">
                  ACTIONS
                </Text>
              </HStack>

              {publicKeys.map(item => (
                <HStack
                  key={item.id}
                  justifyContent="space-between"
                  alignItems="center"
                  borderTopWidth={1}
                  borderTopColor="#334155"
                  py="$3"
                  px="$2"
                  space="sm"
                >
                  <VStack flex={1} minWidth={0} space="xs">
                    <Text color="#f8fafc" fontWeight="700" numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text color={MUTED} fontSize="$xs" numberOfLines={1}>
                      ID {item.id} · {item.public_key_string.length} characters
                    </Text>
                  </VStack>

                  <HStack space="sm" alignItems="center">
                    <Pressable
                      onPress={() => startEdit(item)}
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${item.name}`}
                      hitSlop={8}
                      style={styles.iconButton}
                    >
                      <Pencil size={19} color={YELLOW} />
                    </Pressable>
                    <Pressable
                      onPress={() => confirmDelete(item)}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${item.name}`}
                      hitSlop={8}
                      style={styles.iconButton}
                    >
                      <Trash2 size={19} color="#fca5a5" />
                    </Pressable>
                  </HStack>
                </HStack>
              ))}
              {!publicKeys.length ? (
                <Text color={MUTED} fontSize="$sm" py="$4" textAlign="center">
                  No keys saved yet.
                </Text>
              ) : null}
            </VStack>
          </Box>
        </VStack>
      </Box>

      <Modal
        visible={Boolean(editingKey)}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingKey(null)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setEditingKey(null)}
            accessibilityLabel="Close edit dialog"
          />
          <Box width="100%" maxWidth={520} bg={PANEL} borderWidth={2} borderColor={YELLOW} borderRadius="$xl" p="$4">
            <Text color="#f8fafc" fontSize="$xl" fontWeight="800" mb="$4">
              Edit Public Key
            </Text>

            <VStack space="sm">
              <Input variant="outline" size="lg" borderColor="#334155">
                <InputField
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Key name"
                  placeholderTextColor="#94a3b8"
                  color="#f8fafc"
                />
              </Input>
              <Input variant="outline" size="lg" borderColor="#334155">
                <InputField
                  value={editValue}
                  onChangeText={setEditValue}
                  placeholder="Public key PEM"
                  placeholderTextColor="#94a3b8"
                  color="#f8fafc"
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                  minHeight={140}
                />
              </Input>
              <HStack space="sm" justifyContent="flex-end" mt="$2">
                <Button variant="outline" borderColor="#64748b" onPress={() => setEditingKey(null)}>
                  <ButtonText color="#e2e8f0">Cancel</ButtonText>
                </Button>
                <Button bg={YELLOW} onPress={saveEdit}>
                  <ButtonText color={BLACK} fontWeight="900">Save Changes</ButtonText>
                </Button>
              </HStack>
            </VStack>
          </Box>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111c2e',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.76)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
});
