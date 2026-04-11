import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Dimensions, Image, TouchableOpacity,
  ScrollView, Animated, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import COLORS from '../constants/colors';

var { width, height } = Dimensions.get('window');

var slides = [
  {
    image: require('../../assets/onboarding1.png'),
    title: 'Gagnez avec TeranGO',
    subtitle: 'Conduisez et gagnez a votre rythme',
  },
  {
    image: require('../../assets/onboarding2.png'),
    title: 'Navigation en temps reel',
    subtitle: 'Guidage vocal et itineraire optimal',
  },
  {
    image: require('../../assets/onboarding3.png'),
    title: "Rejoignez l'equipe",
    subtitle: 'Commission la plus basse du marche: 5% seulement',
  },
];

var OnboardingScreen = function(props) {
  var navigation = props.navigation;
  var scrollRef = useRef(null);
  var activeIndexState = useState(0);
  var activeIndex = activeIndexState[0];
  var setActiveIndex = activeIndexState[1];
  var scrollX = useRef(new Animated.Value(0)).current;

  useEffect(function() {
    var interval = setInterval(function() {
      setActiveIndex(function(prev) {
        var next = (prev + 1) % slides.length;
        if (scrollRef.current) {
          scrollRef.current.scrollTo({ x: next * width, animated: true });
        }
        return next;
      });
    }, 4000);
    return function() { clearInterval(interval); };
  }, []);

  var handleDone = useCallback(function() {
    AsyncStorage.setItem('onboardingDone', '1').then(function() {
      navigation.replace('Login');
    });
  }, [navigation]);

  var onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: false }
  );

  var onMomentumScrollEnd = function(e) {
    var index = Math.round(e.nativeEvent.contentOffset.x / width);
    setActiveIndex(index);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        onMomentumScrollEnd={onMomentumScrollEnd}
        scrollEventThrottle={16}
        bounces={false}
      >
        {slides.map(function(slide, index) {
          return (
            <View key={index} style={styles.slide}>
              <Image source={slide.image} style={styles.bgImage} resizeMode="cover" />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.85)']}
                locations={[0, 0.45, 1]}
                style={styles.gradient}
              />
              <View style={styles.logoContainer}>
                <View style={styles.logoCircle}>
                  <Image source={require('../../assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
                </View>
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.title}>{slide.title}</Text>
                <Text style={styles.subtitle}>{slide.subtitle}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.bottomContainer}>
        <View style={styles.dotsRow}>
          {slides.map(function(_, i) {
            var dotWidth = scrollX.interpolate({
              inputRange: [(i - 1) * width, i * width, (i + 1) * width],
              outputRange: [8, 24, 8],
              extrapolate: 'clamp',
            });
            var dotOpacity = scrollX.interpolate({
              inputRange: [(i - 1) * width, i * width, (i + 1) * width],
              outputRange: [0.4, 1, 0.4],
              extrapolate: 'clamp',
            });
            var dotColor = scrollX.interpolate({
              inputRange: [(i - 1) * width, i * width, (i + 1) * width],
              outputRange: ['#FFFFFF', COLORS.yellow, '#FFFFFF'],
              extrapolate: 'clamp',
            });
            return (
              <Animated.View
                key={i}
                style={[styles.dot, { width: dotWidth, opacity: dotOpacity, backgroundColor: dotColor }]}
              />
            );
          })}
        </View>

        {activeIndex < slides.length - 1 && (
          <TouchableOpacity onPress={handleDone} style={styles.skipBtn}>
            <Text style={styles.skipText}>Passer</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.commencerBtn} onPress={handleDone} activeOpacity={0.85}>
          <Text style={styles.commencerText}>Commencer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

var styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  slide: { width: width, height: height },
  bgImage: { width: width, height: height, position: 'absolute' },
  gradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: height * 0.65 },
  logoContainer: { position: 'absolute', top: 60, left: 0, right: 0, alignItems: 'center' },
  logoCircle: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8, overflow: 'hidden',
  },
  logo: { width: 68, height: 68 },
  textContainer: {
    position: 'absolute', bottom: 200, left: 0, right: 0,
    paddingHorizontal: 32, alignItems: 'center',
  },
  title: {
    fontSize: 28, fontFamily: 'LexendDeca_700Bold', color: '#FFFFFF',
    textAlign: 'center', marginBottom: 12, lineHeight: 36,
  },
  subtitle: {
    fontSize: 16, fontFamily: 'LexendDeca_400Regular', color: 'rgba(255,255,255,0.75)',
    textAlign: 'center', lineHeight: 24,
  },
  bottomContainer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 28, paddingBottom: 50, alignItems: 'center',
  },
  dotsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 8 },
  dot: { height: 8, borderRadius: 4 },
  skipBtn: { marginBottom: 14 },
  skipText: { color: 'rgba(255,255,255,0.6)', fontSize: 15, fontFamily: 'LexendDeca_500Medium' },
  commencerBtn: {
    backgroundColor: COLORS.green, width: '100%', paddingVertical: 18,
    borderRadius: 16, alignItems: 'center',
    shadowColor: COLORS.green, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  commencerText: { color: '#FFFFFF', fontSize: 17, fontFamily: 'LexendDeca_700Bold' },
});

export default OnboardingScreen;
