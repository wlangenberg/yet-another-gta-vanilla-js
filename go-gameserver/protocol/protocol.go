package protocol

import (
	"bytes"
	"encoding/binary"
	"errors"
	"io"
	"fmt"
)

// Message types
const (
	// Client -> Server messages
	PlayerUpdateType  byte = 1
	ChatMessageType   byte = 2
	GunFireType       byte = 3
	HitReportType     byte = 4
	PlayerJoinType    byte = 5
	PlayerLeaveType   byte = 6
	PlatformDestroyType byte = 7
	FragmentCreateType byte = 8
	FragmentDestroyType byte = 9

	// Server -> Client messages
	BroadcastPlayerUpdateType byte = 101
	BroadcastChatMessageType  byte = 102
	BroadcastGunFireType      byte = 103
	BroadcastHitReportType    byte = 104
	BroadcastPlayerJoinType   byte = 105
	BroadcastPlayerLeaveType  byte = 106
	InitialStateType          byte = 107
	BroadcastPlatformDestroyType byte = 108
	BroadcastFragmentCreateType byte = 109
	BroadcastFragmentDestroyType byte = 110
)

// Player represents a player in the game
type Player struct {
	ID        int32
	Name      string
	X         float32
	Y         float32
	Width     float32
	Height    float32
	ColorR    float32
	ColorG    float32
	ColorB    float32
	ColorA    float32
	Health    float32
	MaxHealth float32
	IsDead    bool
}

// ChatMessage represents a chat message
type ChatMessage struct {
	PlayerID int32
	Message  string
}

// GunFire represents a gun firing event
type GunFire struct {
	PlayerID int32
	X        float32
	Y        float32
	Angle    float32
	Damage   float32
}

// HitReport represents a hit report
type HitReport struct {
	ShooterID int32
	TargetID  int32
	Damage    float32
}

// PlatformDestroy represents a platform destruction event
type PlatformDestroy struct {
	PlatformID int32
	ShooterID  int32
}

// Fragment represents a fragment created from a destroyed platform
type Fragment struct {
	ID             int32
	OriginalEntityID int32
	X              float32
	Y              float32
	Width          float32
	Height         float32
	VelocityX      float32
	VelocityY      float32
	ColorR         float32
	ColorG         float32
	ColorB         float32
	ColorA         float32
}

// Message is the interface for all protocol messages
type Message interface {
	Type() byte
	Encode() ([]byte, error)
}

// Decoder is the interface for decoding messages
type Decoder interface {
	Decode([]byte) (Message, error)
}

// PlayerUpdateMessage is sent when a player's state changes
type PlayerUpdateMessage struct {
	Player Player
}

func (m PlayerUpdateMessage) Type() byte {
	return PlayerUpdateType
}

func (m PlayerUpdateMessage) Encode() ([]byte, error) {
	buf := new(bytes.Buffer)
	
	// Write message type
	if err := binary.Write(buf, binary.LittleEndian, m.Type()); err != nil {
		return nil, err
	}
	
	// Write player ID
	if err := binary.Write(buf, binary.LittleEndian, m.Player.ID); err != nil {
		return nil, err
	}
	
	// Write player name length and name
	nameBytes := []byte(m.Player.Name)
	nameLen := int32(len(nameBytes))
	if err := binary.Write(buf, binary.LittleEndian, nameLen); err != nil {
		return nil, err
	}
	if _, err := buf.Write(nameBytes); err != nil {
		return nil, err
	}
	
	// Write player position and dimensions
	if err := binary.Write(buf, binary.LittleEndian, m.Player.X); err != nil {
		return nil, err
	}
	if err := binary.Write(buf, binary.LittleEndian, m.Player.Y); err != nil {
		return nil, err
	}
	if err := binary.Write(buf, binary.LittleEndian, m.Player.Width); err != nil {
		return nil, err
	}
	if err := binary.Write(buf, binary.LittleEndian, m.Player.Height); err != nil {
		return nil, err
	}
	
	// Write player color
	if err := binary.Write(buf, binary.LittleEndian, m.Player.ColorR); err != nil {
		return nil, err
	}
	if err := binary.Write(buf, binary.LittleEndian, m.Player.ColorG); err != nil {
		return nil, err
	}
	if err := binary.Write(buf, binary.LittleEndian, m.Player.ColorB); err != nil {
		return nil, err
	}
	if err := binary.Write(buf, binary.LittleEndian, m.Player.ColorA); err != nil {
		return nil, err
	}
	
	// Write player health
	if err := binary.Write(buf, binary.LittleEndian, m.Player.Health); err != nil {
		return nil, err
	}
	if err := binary.Write(buf, binary.LittleEndian, m.Player.MaxHealth); err != nil {
		return nil, err
	}
	
	// Write player is dead flag
	isDead := byte(0)
	if m.Player.IsDead {
		isDead = 1
	}
	if err := binary.Write(buf, binary.LittleEndian, isDead); err != nil {
		return nil, err
	}
	
	return buf.Bytes(), nil
}

// BroadcastPlayerUpdateMessage is sent to all clients when a player's state changes
type BroadcastPlayerUpdateMessage struct {
	Player Player
}

func (m BroadcastPlayerUpdateMessage) Type() byte {
	return BroadcastPlayerUpdateType
}

func (m BroadcastPlayerUpdateMessage) Encode() ([]byte, error) {
	buf := new(bytes.Buffer)
	
	// Write message type
	if err := binary.Write(buf, binary.LittleEndian, m.Type()); err != nil {
		return nil, err
	}
	
	// Write player ID
	if err := binary.Write(buf, binary.LittleEndian, m.Player.ID); err != nil {
		return nil, err
	}
	
	// Write player name length and name
	nameBytes := []byte(m.Player.Name)
	nameLen := int32(len(nameBytes))
	if err := binary.Write(buf, binary.LittleEndian, nameLen); err != nil {
		return nil, err
	}
	if _, err := buf.Write(nameBytes); err != nil {
		return nil, err
	}
	
	// Write player position and dimensions
	if err := binary.Write(buf, binary.LittleEndian, m.Player.X); err != nil {
		return nil, err
	}
	if err := binary.Write(buf, binary.LittleEndian, m.Player.Y); err != nil {
		return nil, err
	}
	if err := binary.Write(buf, binary.LittleEndian, m.Player.Width); err != nil {
		return nil, err
	}
	if err := binary.Write(buf, binary.LittleEndian, m.Player.Height); err != nil {
		return nil, err
	}
	
	// Write player color
	if err := binary.Write(buf, binary.LittleEndian, m.Player.ColorR); err != nil {
		return nil, err
	}
	if err := binary.Write(buf, binary.LittleEndian, m.Player.ColorG); err != nil {
		return nil, err
	}
	if err := binary.Write(buf, binary.LittleEndian, m.Player.ColorB); err != nil {
		return nil, err
	}
	if err := binary.Write(buf, binary.LittleEndian, m.Player.ColorA); err != nil {
		return nil, err
	}
	
	// Write player health
	if err := binary.Write(buf, binary.LittleEndian, m.Player.Health); err != nil {
		return nil, err
	}
	if err := binary.Write(buf, binary.LittleEndian, m.Player.MaxHealth); err != nil {
		return nil, err
	}
	
	// Write player is dead flag
	isDead := byte(0)
	if m.Player.IsDead {
		isDead = 1
	}
	if err := binary.Write(buf, binary.LittleEndian, isDead); err != nil {
		return nil, err
	}
	
	return buf.Bytes(), nil
}

// ChatMessageMessage is sent when a player sends a chat message
type ChatMessageMessage struct {
	Chat ChatMessage
}

func (m ChatMessageMessage) Type() byte {
	return ChatMessageType
}

func (m ChatMessageMessage) Encode() ([]byte, error) {
	buf := new(bytes.Buffer)
	
	// Write message type
	if err := binary.Write(buf, binary.LittleEndian, m.Type()); err != nil {
		return nil, err
	}
	
	// Write player ID
	if err := binary.Write(buf, binary.LittleEndian, m.Chat.PlayerID); err != nil {
		return nil, err
	}
	
	// Write message length and message
	msgBytes := []byte(m.Chat.Message)
	msgLen := int32(len(msgBytes))
	if err := binary.Write(buf, binary.LittleEndian, msgLen); err != nil {
		return nil, err
	}
	if _, err := buf.Write(msgBytes); err != nil {
		return nil, err
	}
	
	return buf.Bytes(), nil
}

// BroadcastChatMessageMessage is sent to all clients when a player sends a chat message
type BroadcastChatMessageMessage struct {
	Chat ChatMessage
}

func (m BroadcastChatMessageMessage) Type() byte {
	return BroadcastChatMessageType
}

func (m BroadcastChatMessageMessage) Encode() ([]byte, error) {
	buf := new(bytes.Buffer)
	
	// Write message type
	if err := binary.Write(buf, binary.LittleEndian, m.Type()); err != nil {
		return nil, err
	}
	
	// Write player ID
	if err := binary.Write(buf, binary.LittleEndian, m.Chat.PlayerID); err != nil {
		return nil, err
	}
	
	// Write message length and message
	msgBytes := []byte(m.Chat.Message)
	msgLen := int32(len(msgBytes))
	if err := binary.Write(buf, binary.LittleEndian, msgLen); err != nil {
		return nil, err
	}
	if _, err := buf.Write(msgBytes); err != nil {
		return nil, err
	}
	
	return buf.Bytes(), nil
}

// GunFireMessage is sent when a player fires a gun
type GunFireMessage struct {
	Fire GunFire
}

func (m GunFireMessage) Type() byte {
	return GunFireType
}

func (m GunFireMessage) Encode() ([]byte, error) {
	buf := new(bytes.Buffer)
	
	// Write message type
	if err := binary.Write(buf, binary.LittleEndian, m.Type()); err != nil {
		return nil, err
	}
	
	// Write player ID
	if err := binary.Write(buf, binary.LittleEndian, m.Fire.PlayerID); err != nil {
		return nil, err
	}
	
	// Write position and angle
	if err := binary.Write(buf, binary.LittleEndian, m.Fire.X); err != nil {
		return nil, err
	}
	if err := binary.Write(buf, binary.LittleEndian, m.Fire.Y); err != nil {
		return nil, err
	}
	if err := binary.Write(buf, binary.LittleEndian, m.Fire.Angle); err != nil {
		return nil, err
	}
	if err := binary.Write(buf, binary.LittleEndian, m.Fire.Damage); err != nil {
		return nil, err
	}
	
	return buf.Bytes(), nil
}

// BroadcastGunFireMessage is sent to all clients when a player fires a gun
type BroadcastGunFireMessage struct {
	Fire GunFire
}

func (m BroadcastGunFireMessage) Type() byte {
	return BroadcastGunFireType
}

func (m BroadcastGunFireMessage) Encode() ([]byte, error) {
	buf := new(bytes.Buffer)
	
	// Write message type
	if err := binary.Write(buf, binary.LittleEndian, m.Type()); err != nil {
		return nil, err
	}
	
	// Write player ID
	if err := binary.Write(buf, binary.LittleEndian, m.Fire.PlayerID); err != nil {
		return nil, err
	}
	
	// Write position and angle
	if err := binary.Write(buf, binary.LittleEndian, m.Fire.X); err != nil {
		return nil, err
	}
	if err := binary.Write(buf, binary.LittleEndian, m.Fire.Y); err != nil {
		return nil, err
	}
	if err := binary.Write(buf, binary.LittleEndian, m.Fire.Angle); err != nil {
		return nil, err
	}
	if err := binary.Write(buf, binary.LittleEndian, m.Fire.Damage); err != nil {
		return nil, err
	}
	
	return buf.Bytes(), nil
}

// HitReportMessage is sent when a player hits another player
type HitReportMessage struct {
	Hit HitReport
}

func (m HitReportMessage) Type() byte {
	return HitReportType
}

func (m HitReportMessage) Encode() ([]byte, error) {
	buf := new(bytes.Buffer)
	
	// Write message type
	if err := binary.Write(buf, binary.LittleEndian, m.Type()); err != nil {
		return nil, err
	}
	
	// Write shooter and target IDs
	if err := binary.Write(buf, binary.LittleEndian, m.Hit.ShooterID); err != nil {
		return nil, err
	}
	if err := binary.Write(buf, binary.LittleEndian, m.Hit.TargetID); err != nil {
		return nil, err
	}
	
	// Write damage
	if err := binary.Write(buf, binary.LittleEndian, m.Hit.Damage); err != nil {
		return nil, err
	}
	
	return buf.Bytes(), nil
}

// BroadcastHitReportMessage is sent to all clients when a player hits another player
type BroadcastHitReportMessage struct {
	Hit HitReport
}

func (m BroadcastHitReportMessage) Type() byte {
	return BroadcastHitReportType
}

func (m BroadcastHitReportMessage) Encode() ([]byte, error) {
	buf := new(bytes.Buffer)
	
	// Write message type
	if err := binary.Write(buf, binary.LittleEndian, m.Type()); err != nil {
		return nil, err
	}
	
	// Write shooter and target IDs
	if err := binary.Write(buf, binary.LittleEndian, m.Hit.ShooterID); err != nil {
		return nil, err
	}
	if err := binary.Write(buf, binary.LittleEndian, m.Hit.TargetID); err != nil {
		return nil, err
	}
	
	// Write damage
	if err := binary.Write(buf, binary.LittleEndian, m.Hit.Damage); err != nil {
		return nil, err
	}
	
	return buf.Bytes(), nil
}

// PlayerJoinMessage is sent when a player joins the game
type PlayerJoinMessage struct {
	PlayerID int32
}

func (m PlayerJoinMessage) Type() byte {
	return PlayerJoinType
}

func (m PlayerJoinMessage) Encode() ([]byte, error) {
	buf := new(bytes.Buffer)
	
	// Write message type
	if err := binary.Write(buf, binary.LittleEndian, m.Type()); err != nil {
		return nil, err
	}
	
	// Write player ID
	if err := binary.Write(buf, binary.LittleEndian, m.PlayerID); err != nil {
		return nil, err
	}
	
	return buf.Bytes(), nil
}

// BroadcastPlayerJoinMessage is sent to all clients when a player joins the game
type BroadcastPlayerJoinMessage struct {
	PlayerID int32
}

func (m BroadcastPlayerJoinMessage) Type() byte {
	return BroadcastPlayerJoinType
}

func (m BroadcastPlayerJoinMessage) Encode() ([]byte, error) {
	buf := new(bytes.Buffer)
	
	// Write message type
	if err := binary.Write(buf, binary.LittleEndian, m.Type()); err != nil {
		return nil, err
	}
	
	// Write player ID
	if err := binary.Write(buf, binary.LittleEndian, m.PlayerID); err != nil {
		return nil, err
	}
	
	return buf.Bytes(), nil
}

// PlayerLeaveMessage is sent when a player leaves the game
type PlayerLeaveMessage struct {
	PlayerID int32
}

func (m PlayerLeaveMessage) Type() byte {
	return PlayerLeaveType
}

func (m PlayerLeaveMessage) Encode() ([]byte, error) {
	buf := new(bytes.Buffer)
	
	// Write message type
	if err := binary.Write(buf, binary.LittleEndian, m.Type()); err != nil {
		return nil, err
	}
	
	// Write player ID
	if err := binary.Write(buf, binary.LittleEndian, m.PlayerID); err != nil {
		return nil, err
	}
	
	return buf.Bytes(), nil
}

// BroadcastPlayerLeaveMessage is sent to all clients when a player leaves the game
type BroadcastPlayerLeaveMessage struct {
	PlayerID int32
}

func (m BroadcastPlayerLeaveMessage) Type() byte {
	return BroadcastPlayerLeaveType
}

func (m BroadcastPlayerLeaveMessage) Encode() ([]byte, error) {
	buf := new(bytes.Buffer)
	
	// Write message type
	if err := binary.Write(buf, binary.LittleEndian, m.Type()); err != nil {
		return nil, err
	}
	
	// Write player ID
	if err := binary.Write(buf, binary.LittleEndian, m.PlayerID); err != nil {
		return nil, err
	}
	
	return buf.Bytes(), nil
}

// InitialStateMessage is sent to a client when they first connect
type InitialStateMessage struct {
	Players []Player
}

func (m InitialStateMessage) Type() byte {
	return InitialStateType
}

func (m InitialStateMessage) Encode() ([]byte, error) {
	buf := new(bytes.Buffer)
	
	// Write message type
	if err := binary.Write(buf, binary.LittleEndian, m.Type()); err != nil {
		return nil, err
	}
	
	// Write number of players
	playerCount := int32(len(m.Players))
	if err := binary.Write(buf, binary.LittleEndian, playerCount); err != nil {
		return nil, err
	}
	
	// Write each player
	for _, player := range m.Players {
		// Write player ID
		if err := binary.Write(buf, binary.LittleEndian, player.ID); err != nil {
			return nil, err
		}
		
		// Write player name length and name
		nameBytes := []byte(player.Name)
		nameLen := int32(len(nameBytes))
		if err := binary.Write(buf, binary.LittleEndian, nameLen); err != nil {
			return nil, err
		}
		if _, err := buf.Write(nameBytes); err != nil {
			return nil, err
		}
		
		// Write player position and dimensions
		if err := binary.Write(buf, binary.LittleEndian, player.X); err != nil {
			return nil, err
		}
		if err := binary.Write(buf, binary.LittleEndian, player.Y); err != nil {
			return nil, err
		}
		if err := binary.Write(buf, binary.LittleEndian, player.Width); err != nil {
			return nil, err
		}
		if err := binary.Write(buf, binary.LittleEndian, player.Height); err != nil {
			return nil, err
		}
		
		// Write player color
		if err := binary.Write(buf, binary.LittleEndian, player.ColorR); err != nil {
			return nil, err
		}
		if err := binary.Write(buf, binary.LittleEndian, player.ColorG); err != nil {
			return nil, err
		}
		if err := binary.Write(buf, binary.LittleEndian, player.ColorB); err != nil {
			return nil, err
		}
		if err := binary.Write(buf, binary.LittleEndian, player.ColorA); err != nil {
			return nil, err
		}
		
		// Write player health
		if err := binary.Write(buf, binary.LittleEndian, player.Health); err != nil {
			return nil, err
		}
		if err := binary.Write(buf, binary.LittleEndian, player.MaxHealth); err != nil {
			return nil, err
		}
		
		// Write player is dead flag
		isDead := byte(0)
		if player.IsDead {
			isDead = 1
		}
		if err := binary.Write(buf, binary.LittleEndian, isDead); err != nil {
			return nil, err
		}
	}
	
	return buf.Bytes(), nil
}

// DecodeMessage decodes a binary message into a Message
func DecodeMessage(data []byte) (Message, error) {
	if len(data) == 0 {
		return nil, errors.New("empty message")
	}
	
	msgType := data[0]
	reader := bytes.NewReader(data[1:])
	
	switch msgType {
	case PlayerUpdateType:
		return decodePlayerUpdateMessage(reader)
	case ChatMessageType:
		return decodeChatMessageMessage(reader)
	case GunFireType:
		return decodeGunFireMessage(reader)
	case HitReportType:
		return decodeHitReportMessage(reader)
	case PlayerJoinType:
		return decodePlayerJoinMessage(reader)
	case PlayerLeaveType:
		return decodePlayerLeaveMessage(reader)
	case PlatformDestroyType:
		return decodePlatformDestroyMessage(reader)
	case FragmentCreateType:
		return decodeFragmentCreateMessage(reader)
	case FragmentDestroyType:
		return decodeFragmentDestroyMessage(reader)
	default:
		return nil, errors.New("unknown message type")
	}
}

func decodePlayerUpdateMessage(reader *bytes.Reader) (Message, error) {
	var player Player
	
	// Read player ID
	if err := binary.Read(reader, binary.LittleEndian, &player.ID); err != nil {
		return nil, err
	}
	
	// Read player name
	var nameLen int32
	if err := binary.Read(reader, binary.LittleEndian, &nameLen); err != nil {
		return nil, err
	}
	nameBytes := make([]byte, nameLen)
	if _, err := io.ReadFull(reader, nameBytes); err != nil {
		return nil, err
	}
	player.Name = string(nameBytes)
	
	// Read player position and dimensions
	if err := binary.Read(reader, binary.LittleEndian, &player.X); err != nil {
		return nil, err
	}
	if err := binary.Read(reader, binary.LittleEndian, &player.Y); err != nil {
		return nil, err
	}
	if err := binary.Read(reader, binary.LittleEndian, &player.Width); err != nil {
		return nil, err
	}
	if err := binary.Read(reader, binary.LittleEndian, &player.Height); err != nil {
		return nil, err
	}
	
	// Read player color
	if err := binary.Read(reader, binary.LittleEndian, &player.ColorR); err != nil {
		return nil, err
	}
	if err := binary.Read(reader, binary.LittleEndian, &player.ColorG); err != nil {
		return nil, err
	}
	if err := binary.Read(reader, binary.LittleEndian, &player.ColorB); err != nil {
		return nil, err
	}
	if err := binary.Read(reader, binary.LittleEndian, &player.ColorA); err != nil {
		return nil, err
	}
	
	// Read player health
	if err := binary.Read(reader, binary.LittleEndian, &player.Health); err != nil {
		return nil, err
	}
	if err := binary.Read(reader, binary.LittleEndian, &player.MaxHealth); err != nil {
		return nil, err
	}
	
	// Read player is dead flag
	var isDead byte
	if err := binary.Read(reader, binary.LittleEndian, &isDead); err != nil {
		return nil, err
	}
	player.IsDead = isDead != 0
	
	return PlayerUpdateMessage{Player: player}, nil
}

func decodeChatMessageMessage(reader *bytes.Reader) (Message, error) {
	var chat ChatMessage
	
	// Read player ID
	if err := binary.Read(reader, binary.LittleEndian, &chat.PlayerID); err != nil {
		return nil, err
	}
	
	// Read message
	var msgLen int32
	if err := binary.Read(reader, binary.LittleEndian, &msgLen); err != nil {
		return nil, err
	}
	msgBytes := make([]byte, msgLen)
	if _, err := io.ReadFull(reader, msgBytes); err != nil {
		return nil, err
	}
	chat.Message = string(msgBytes)
	
	return ChatMessageMessage{Chat: chat}, nil
}

func decodeGunFireMessage(reader *bytes.Reader) (Message, error) {
	var fire GunFire
	
	// Read player ID
	if err := binary.Read(reader, binary.LittleEndian, &fire.PlayerID); err != nil {
		return nil, err
	}
	
	// Read position and angle
	if err := binary.Read(reader, binary.LittleEndian, &fire.X); err != nil {
		return nil, err
	}
	if err := binary.Read(reader, binary.LittleEndian, &fire.Y); err != nil {
		return nil, err
	}
	if err := binary.Read(reader, binary.LittleEndian, &fire.Angle); err != nil {
		return nil, err
	}
	if err := binary.Read(reader, binary.LittleEndian, &fire.Damage); err != nil {
		return nil, err
	}
	
	return GunFireMessage{Fire: fire}, nil
}

func decodeHitReportMessage(reader *bytes.Reader) (Message, error) {
	var hit HitReport
	
	// Read shooter and target IDs
	if err := binary.Read(reader, binary.LittleEndian, &hit.ShooterID); err != nil {
		return nil, err
	}
	if err := binary.Read(reader, binary.LittleEndian, &hit.TargetID); err != nil {
		return nil, err
	}
	
	// Read damage
	if err := binary.Read(reader, binary.LittleEndian, &hit.Damage); err != nil {
		return nil, err
	}
	
	return HitReportMessage{Hit: hit}, nil
}

func decodePlayerJoinMessage(reader *bytes.Reader) (Message, error) {
	var playerID int32
	
	// Read player ID
	if err := binary.Read(reader, binary.LittleEndian, &playerID); err != nil {
		return nil, err
	}
	
	return PlayerJoinMessage{PlayerID: playerID}, nil
}

func decodePlayerLeaveMessage(reader *bytes.Reader) (Message, error) {
	var playerID int32
	
	// Read player ID
	if err := binary.Read(reader, binary.LittleEndian, &playerID); err != nil {
		return nil, err
	}
	
	return PlayerLeaveMessage{PlayerID: playerID}, nil
}

// PlatformDestroyMessage is sent when a player destroys a platform
type PlatformDestroyMessage struct {
	Destroy PlatformDestroy
}

func (m PlatformDestroyMessage) Type() byte {
	return PlatformDestroyType
}

func (m PlatformDestroyMessage) Encode() ([]byte, error) {
	buf := new(bytes.Buffer)
	
	// Write message type
	if err := binary.Write(buf, binary.LittleEndian, m.Type()); err != nil {
		return nil, err
	}
	
	// Write platform and shooter IDs
	if err := binary.Write(buf, binary.LittleEndian, m.Destroy.PlatformID); err != nil {
		return nil, err
	}
	if err := binary.Write(buf, binary.LittleEndian, m.Destroy.ShooterID); err != nil {
		return nil, err
	}
	
	return buf.Bytes(), nil
}

// BroadcastPlatformDestroyMessage is sent to all clients when a platform is destroyed
type BroadcastPlatformDestroyMessage struct {
	Destroy PlatformDestroy
}

func (m BroadcastPlatformDestroyMessage) Type() byte {
	return BroadcastPlatformDestroyType
}

func (m BroadcastPlatformDestroyMessage) Encode() ([]byte, error) {
	buf := new(bytes.Buffer)
	
	// Write message type
	if err := binary.Write(buf, binary.LittleEndian, m.Type()); err != nil {
		return nil, err
	}
	
	// Write platform and shooter IDs
	if err := binary.Write(buf, binary.LittleEndian, m.Destroy.PlatformID); err != nil {
		return nil, err
	}
	if err := binary.Write(buf, binary.LittleEndian, m.Destroy.ShooterID); err != nil {
		return nil, err
	}
	
	return buf.Bytes(), nil
}

// FragmentCreateMessage is sent when a fragment is created from a destroyed platform
type FragmentCreateMessage struct {
	Fragment Fragment
}

func (m FragmentCreateMessage) Type() byte {
	return FragmentCreateType
}

func (m FragmentCreateMessage) Encode() ([]byte, error) {
	buf := new(bytes.Buffer)
	
	// Write message type
	if err := binary.Write(buf, binary.LittleEndian, m.Type()); err != nil {
		return nil, err
	}
	
	// Write fragment ID and original entity ID
	if err := binary.Write(buf, binary.LittleEndian, m.Fragment.ID); err != nil {
		return nil, err
	}
	if err := binary.Write(buf, binary.LittleEndian, m.Fragment.OriginalEntityID); err != nil {
		return nil, err
	}
	
	// Write position and dimensions
	if err := binary.Write(buf, binary.LittleEndian, m.Fragment.X); err != nil {
		return nil, err
	}
	if err := binary.Write(buf, binary.LittleEndian, m.Fragment.Y); err != nil {
		return nil, err
	}
	if err := binary.Write(buf, binary.LittleEndian, m.Fragment.Width); err != nil {
		return nil, err
	}
	if err := binary.Write(buf, binary.LittleEndian, m.Fragment.Height); err != nil {
		return nil, err
	}
	
	// Write velocity
	if err := binary.Write(buf, binary.LittleEndian, m.Fragment.VelocityX); err != nil {
		return nil, err
	}
	if err := binary.Write(buf, binary.LittleEndian, m.Fragment.VelocityY); err != nil {
		return nil, err
	}
	
	// Write color
	if err := binary.Write(buf, binary.LittleEndian, m.Fragment.ColorR); err != nil {
		return nil, err
	}
	if err := binary.Write(buf, binary.LittleEndian, m.Fragment.ColorG); err != nil {
		return nil, err
	}
	if err := binary.Write(buf, binary.LittleEndian, m.Fragment.ColorB); err != nil {
		return nil, err
	}
	if err := binary.Write(buf, binary.LittleEndian, m.Fragment.ColorA); err != nil {
		return nil, err
	}
	
	return buf.Bytes(), nil
}

// BroadcastFragmentCreateMessage is sent to all clients when a fragment is created
type BroadcastFragmentCreateMessage struct {
	Fragment Fragment
}

func (m BroadcastFragmentCreateMessage) Type() byte {
	return BroadcastFragmentCreateType
}

func (m BroadcastFragmentCreateMessage) Encode() ([]byte, error) {
	buf := new(bytes.Buffer)
	
	// Write message type
	if err := binary.Write(buf, binary.LittleEndian, m.Type()); err != nil {
		return nil, err
	}
	
	// Write fragment ID and original entity ID
	if err := binary.Write(buf, binary.LittleEndian, m.Fragment.ID); err != nil {
		return nil, err
	}
	if err := binary.Write(buf, binary.LittleEndian, m.Fragment.OriginalEntityID); err != nil {
		return nil, err
	}
	
	// Write position and dimensions
	if err := binary.Write(buf, binary.LittleEndian, m.Fragment.X); err != nil {
		return nil, err
	}
	if err := binary.Write(buf, binary.LittleEndian, m.Fragment.Y); err != nil {
		return nil, err
	}
	if err := binary.Write(buf, binary.LittleEndian, m.Fragment.Width); err != nil {
		return nil, err
	}
	if err := binary.Write(buf, binary.LittleEndian, m.Fragment.Height); err != nil {
		return nil, err
	}
	
	// Write velocity
	if err := binary.Write(buf, binary.LittleEndian, m.Fragment.VelocityX); err != nil {
		return nil, err
	}
	if err := binary.Write(buf, binary.LittleEndian, m.Fragment.VelocityY); err != nil {
		return nil, err
	}
	
	// Write color
	if err := binary.Write(buf, binary.LittleEndian, m.Fragment.ColorR); err != nil {
		return nil, err
	}
	if err := binary.Write(buf, binary.LittleEndian, m.Fragment.ColorG); err != nil {
		return nil, err
	}
	if err := binary.Write(buf, binary.LittleEndian, m.Fragment.ColorB); err != nil {
		return nil, err
	}
	if err := binary.Write(buf, binary.LittleEndian, m.Fragment.ColorA); err != nil {
		return nil, err
	}
	
	return buf.Bytes(), nil
}

func decodePlatformDestroyMessage(reader *bytes.Reader) (Message, error) {
	var destroy PlatformDestroy
	
	// Read platform and shooter IDs
	if err := binary.Read(reader, binary.LittleEndian, &destroy.PlatformID); err != nil {
		return nil, err
	}
	if err := binary.Read(reader, binary.LittleEndian, &destroy.ShooterID); err != nil {
		return nil, err
	}
	
	return PlatformDestroyMessage{Destroy: destroy}, nil
}

// FragmentDestroy represents a fragment destruction event
type FragmentDestroy struct {
	FragmentID int32
}

// FragmentDestroyMessage is sent when a fragment is destroyed
type FragmentDestroyMessage struct {
	Destroy FragmentDestroy
}

func (m FragmentDestroyMessage) Type() byte {
	return FragmentDestroyType
}

func (m FragmentDestroyMessage) Encode() ([]byte, error) {
	buf := new(bytes.Buffer)
	
	// Write message type
	if err := binary.Write(buf, binary.LittleEndian, m.Type()); err != nil {
		return nil, err
	}
	
	// Write fragment ID
	if err := binary.Write(buf, binary.LittleEndian, m.Destroy.FragmentID); err != nil {
		return nil, err
	}
	
	return buf.Bytes(), nil
}

// BroadcastFragmentDestroyMessage is sent to all clients when a fragment is destroyed
type BroadcastFragmentDestroyMessage struct {
	Destroy FragmentDestroy
}

func (m BroadcastFragmentDestroyMessage) Type() byte {
	return BroadcastFragmentDestroyType
}

func (m BroadcastFragmentDestroyMessage) Encode() ([]byte, error) {
	buf := new(bytes.Buffer)
	
	// Write message type
	if err := binary.Write(buf, binary.LittleEndian, m.Type()); err != nil {
		return nil, err
	}
	
	// Write fragment ID
	if err := binary.Write(buf, binary.LittleEndian, m.Destroy.FragmentID); err != nil {
		return nil, err
	}
	
	return buf.Bytes(), nil
}

func decodeFragmentDestroyMessage(reader *bytes.Reader) (Message, error) {
	var destroy FragmentDestroy
	
	// Read fragment ID
	if err := binary.Read(reader, binary.LittleEndian, &destroy.FragmentID); err != nil {
		return nil, err
	}
	
	return FragmentDestroyMessage{Destroy: destroy}, nil
}

func decodeFragmentCreateMessage(reader *bytes.Reader) (Message, error) {
	var fragment Fragment
	
	// Read fragment ID and original entity ID
	if err := binary.Read(reader, binary.LittleEndian, &fragment.ID); err != nil {
		return nil, err
	}
	if err := binary.Read(reader, binary.LittleEndian, &fragment.OriginalEntityID); err != nil {
		return nil, err
	}
	
	// Read position and dimensions
	if err := binary.Read(reader, binary.LittleEndian, &fragment.X); err != nil {
		return nil, err
	}
	if err := binary.Read(reader, binary.LittleEndian, &fragment.Y); err != nil {
		return nil, err
	}
	if err := binary.Read(reader, binary.LittleEndian, &fragment.Width); err != nil {
		return nil, err
	}
	if err := binary.Read(reader, binary.LittleEndian, &fragment.Height); err != nil {
		return nil, err
	}
	
	// Read velocity
	if err := binary.Read(reader, binary.LittleEndian, &fragment.VelocityX); err != nil {
		return nil, err
	}
	if err := binary.Read(reader, binary.LittleEndian, &fragment.VelocityY); err != nil {
		return nil, err
	}
	
	// Read color
	if err := binary.Read(reader, binary.LittleEndian, &fragment.ColorR); err != nil {
		return nil, err
	}
	if err := binary.Read(reader, binary.LittleEndian, &fragment.ColorG); err != nil {
		return nil, err
	}
	if err := binary.Read(reader, binary.LittleEndian, &fragment.ColorB); err != nil {
		return nil, err
	}
	if err := binary.Read(reader, binary.LittleEndian, &fragment.ColorA); err != nil {
		return nil, err
	}
	
	return FragmentCreateMessage{Fragment: fragment}, nil
}

// ParseColorString parses a color string in the format "[r,g,b,a]" into separate components
func ParseColorString(colorStr string) (r, g, b, a float32) {
	// Default values
	r, g, b, a = 1.0, 1.0, 1.0, 1.0
	
	// Try to parse the color string
	var colorArray [4]float64
	_, err := fmt.Sscanf(colorStr, "[%f,%f,%f,%f]", &colorArray[0], &colorArray[1], &colorArray[2], &colorArray[3])
	if err == nil {
		r = float32(colorArray[0])
		g = float32(colorArray[1])
		b = float32(colorArray[2])
		a = float32(colorArray[3])
	}
	
	return r, g, b, a
}

// ColorToString converts color components to a string in the format "[r,g,b,a]"
func ColorToString(r, g, b, a float32) string {
	return fmt.Sprintf("[%f,%f,%f,%f]", r, g, b, a)
}
