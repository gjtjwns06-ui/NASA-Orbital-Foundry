import {freezeTransferInput} from './immutable';
import {canonicalOperationsJson,operationsSha256} from './operations-codec';
import {transferGroundStations,TRANSFER_EARTH_RADIUS_KM} from './state';
/** Independent command model; the released hardware catalogue is unchanged. */
export const COMMAND_NETWORK=freezeTransferInput({
 id:'omf-command-network-1.0.0',supportedRadioModelId:'iris22-carrier-v1',supportedAntennaModelId:'xband-reflector-1m-v1',
 groundGeometry:{stations:transferGroundStations(),latitudeLongitudeUnits:'degrees',altitudeKm:0,sphericalEarthRadiusKm:TRANSFER_EARTH_RADIUS_KM,rotation:{model:'released educational GMST polynomial, no UT1/EOP model',tdbToApproxUtOffsetSeconds:69.184,referenceJd:2451545,referenceGmstDegrees:280.46061837,degreesPerDay:360.98564736629,centuryDays:36525,squareTermDegrees:.000387933,cubicTermDivisor:38710000}},
 uplinkFrequencyHz:7167500000,maximumGroundEirpDbW:109.4,minimumGroundEirpDbW:89.4,targetReceiverPowerDbm:-100,
 propagationAndPolarizationLossDb:3,receiveDishDiameterM:1,receiveApertureEfficiency:.55,receiverNoiseFigureDb:2.5,
 antennaNoiseTemperatureK:100,receiverFeedLossDb:1,receiverFeedPhysicalTemperatureK:290,noiseFigureReferenceTemperatureK:290,negativeBoltzmannDb:228.6,
 uplinkInformationRateBps:256,uplinkCodedSymbolRate:512,requiredInformationEbNoDb:6,requiredMarginDb:3,
 receiveTrackingMinimumDbm:-147,receiveTrackingMaximumDbm:-70,downlinkHalfPowerAngleDeg:1.25,referenceDownlinkFrequencyHz:8400000000,
 minimumElevationDeg:5,solarExclusionDeg:3,minimumClearFraction:.6,irisRxPowerW:9.1,irisTxPowerW:25,irisSimultaneousPowerW:29,
 maximumPayloadBytes:8192,commandFramingBytes:64,acknowledgementBytes:512,maximumCommands:128,maximumActions:256,maximumAttemptsPerCommand:32,
 defaultExpirySeconds:21600,maximumExpirySeconds:86400,attentionGraceSeconds:600,uplinkInterframeGapSeconds:1,maximumSaveBytes:8388608,
 lightTimeResidualSeconds:.000001,lightTimeIterations:12,minimumGuardIntervalSeconds:.01,
 defaultActiveStepSeconds:1,encounterStepSeconds:5,downlinkStepSeconds:60,
 assumptions:['Five educational stations; no real DSN allocation.','Fixed information/coding budgets; no implemented bit-level FEC or stochastic BER.','Authored antenna temperature/feed loss, decoding margin and receiver beam-frequency scaling.','One-second interframe guard; explicit retries only.','Iris mode power uses the brochure 12 V table, not inconsistent headline values.'],
 sources:{iris:'https://scienceandtechnology.jpl.nasa.gov/sites/default/files/documents/Brochure_Iris_Transponder_V2.2_SEP_2022.pdf',dsn:'https://deepspace.jpl.nasa.gov/dsndocs/810-005/104/104O.pdf',noise:'https://ntrs.nasa.gov/api/citations/19690013449/downloads/19690013449.pdf',halfDuplex:'https://gomspace.com/wp-content/uploads/2025/09/gs-ds-nanocom-ax100.pdf'},
});
export const COMMAND_NETWORK_ID=COMMAND_NETWORK.id;
export const COMMAND_NETWORK_HASH=operationsSha256(canonicalOperationsJson(COMMAND_NETWORK));
