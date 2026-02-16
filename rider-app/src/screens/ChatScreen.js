import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, KeyboardAvoidingView, Platform, SafeAreaView } from 'react-native';
import COLORS from '../constants/colors';

var ChatScreen = function(props) {
  var socket = props.socket; var rideId = props.rideId || null; var deliveryId = props.deliveryId || null;
  var myRole = props.myRole; var myUserId = props.myUserId;
  var otherName = props.otherName || (myRole === 'rider' ? 'Chauffeur' : 'Passager');
  var onClose = props.onClose;
  var msgState = useState([]); var messages = msgState[0]; var setMessages = msgState[1];
  var inputState = useState(''); var inputText = inputState[0]; var setInputText = inputState[1];
  var flatListRef = useRef(null);

  useEffect(function() {
    if (!socket) return;
    socket.emit('chat-history', { rideId: rideId, deliveryId: deliveryId });
    socket.on('chat-history-response', function(history) { setMessages(history); });
    socket.on('new-chat-message', function(msg) { setMessages(function(prev) { return prev.concat([msg]); }); });
    return function() { socket.off('chat-history-response'); socket.off('new-chat-message'); };
  }, [socket, rideId, deliveryId]);

  useEffect(function() {
    if (messages.length > 0 && flatListRef.current) { setTimeout(function() { flatListRef.current.scrollToEnd({ animated: true }); }, 100); }
  }, [messages]);

  function handleSend() {
    if (!inputText.trim() || !socket) return;
    socket.emit('chat-message', { rideId: rideId, deliveryId: deliveryId, senderRole: myRole, text: inputText.trim() });
    setInputText('');
  }

  function formatTime(dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr); var h = d.getHours().toString(); var m = d.getMinutes().toString();
    if (h.length < 2) h = '0' + h; if (m.length < 2) m = '0' + m;
    return h + ':' + m;
  }

  function renderMessage(item) {
    var msg = item.item; var isMe = msg.senderRole === myRole;
    return (
      <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther]}>
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
          <Text style={[styles.msgText, isMe ? styles.msgTextMe : styles.msgTextOther]}>{msg.text}</Text>
          <Text style={[styles.msgTime, isMe ? styles.msgTimeMe : styles.msgTimeOther]}>{formatTime(msg.createdAt)}</Text>
        </View>
      </View>
    );
  }

  function renderEmpty() {
    return (<View style={styles.emptyWrap}><Text style={styles.emptyIcon}>{String.fromCodePoint(0x1F4AC)}</Text><Text style={styles.emptyText}>{'Envoyez un message \u00e0 ' + otherName}</Text></View>);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onClose}><Text style={styles.backArrow}>{String.fromCodePoint(0x2190)}</Text></TouchableOpacity>
        <View style={styles.headerInfo}><Text style={styles.headerName}>{otherName}</Text><Text style={styles.headerSub}>En ligne</Text></View>
      </View>
      <FlatList ref={flatListRef} data={messages} keyExtractor={function(item, index) { return item._id || index.toString(); }} renderItem={renderMessage} style={styles.messageList} contentContainerStyle={messages.length === 0 ? styles.emptyContainer : styles.listContent} ListEmptyComponent={renderEmpty} onContentSizeChange={function() { if (flatListRef.current && messages.length > 0) flatListRef.current.scrollToEnd({ animated: false }); }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        <View style={styles.inputRow}>
          <TextInput style={styles.input} value={inputText} onChangeText={setInputText} placeholder="Votre message..." placeholderTextColor="#999" maxLength={500} multiline={false} returnKeyType="send" onSubmitEditing={handleSend} />
          <TouchableOpacity style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]} onPress={handleSend} disabled={!inputText.trim()}>
            <Text style={styles.sendIcon}>{String.fromCodePoint(0x27A4)}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

var styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 50, paddingBottom: 14, paddingHorizontal: 16, backgroundColor: COLORS.darkCard, borderBottomWidth: 1, borderBottomColor: COLORS.darkCardBorder },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  backArrow: { fontSize: 22, color: COLORS.green },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 17, fontWeight: '700', color: COLORS.textLight },
  headerSub: { fontSize: 12, color: COLORS.green, marginTop: 2 },
  messageList: { flex: 1 },
  listContent: { paddingHorizontal: 12, paddingVertical: 8 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyWrap: { alignItems: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: '#999' },
  msgRow: { marginVertical: 3 },
  msgRowMe: { alignItems: 'flex-end' },
  msgRowOther: { alignItems: 'flex-start' },
  bubble: { maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleMe: { backgroundColor: COLORS.green, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: COLORS.darkCard, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: COLORS.darkCardBorder },
  msgText: { fontSize: 15, lineHeight: 20 },
  msgTextMe: { color: '#fff' },
  msgTextOther: { color: COLORS.textLight },
  msgTime: { fontSize: 10, marginTop: 4 },
  msgTimeMe: { color: 'rgba(255,255,255,0.5)', textAlign: 'right' },
  msgTimeOther: { color: 'rgba(255,255,255,0.4)' },
  inputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5E5E5' },
  input: { flex: 1, backgroundColor: COLORS.background, borderRadius: 24, paddingHorizontal: 18, paddingVertical: 12, fontSize: 15, color: '#1A1A1A', marginRight: 10, borderWidth: 1, borderColor: '#E5E5E5' },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.green, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
  sendIcon: { fontSize: 20, color: '#fff' },
});

export default ChatScreen;
