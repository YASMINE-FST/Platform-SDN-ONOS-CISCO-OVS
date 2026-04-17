-- MySQL dump 10.13  Distrib 8.0.45, for Linux (x86_64)
--
-- Host: localhost    Database: observium
-- ------------------------------------------------------
-- Server version	8.0.45-0ubuntu0.22.04.1

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `accesspoints`
--

DROP TABLE IF EXISTS `accesspoints`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `accesspoints` (
  `accesspoint_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `radio_number` tinyint DEFAULT NULL,
  `type` varchar(16) NOT NULL,
  `mac_addr` varchar(24) NOT NULL,
  `deleted` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`accesspoint_id`),
  KEY `deleted` (`deleted`),
  KEY `name` (`name`,`radio_number`),
  KEY `device_id` (`device_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COMMENT='Access Points';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `accesspoints-state`
--

DROP TABLE IF EXISTS `accesspoints-state`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `accesspoints-state` (
  `accesspoint_id` int NOT NULL,
  `channel` tinyint unsigned NOT NULL DEFAULT '0',
  `txpow` tinyint NOT NULL DEFAULT '0',
  `radioutil` tinyint NOT NULL DEFAULT '0',
  `numasoclients` smallint NOT NULL DEFAULT '0',
  `nummonclients` smallint NOT NULL DEFAULT '0',
  `numactbssid` tinyint NOT NULL DEFAULT '0',
  `nummonbssid` tinyint NOT NULL DEFAULT '0',
  `interference` tinyint unsigned NOT NULL,
  PRIMARY KEY (`accesspoint_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COMMENT='Access Points';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `alert_assoc`
--

DROP TABLE IF EXISTS `alert_assoc`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `alert_assoc` (
  `alert_assoc_id` int NOT NULL AUTO_INCREMENT,
  `alert_test_id` int NOT NULL,
  `entity_type` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `device_attribs` text CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci,
  `entity_attribs` text CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci,
  `enable` tinyint(1) NOT NULL DEFAULT '1',
  `alerter` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `severity` int DEFAULT NULL,
  `count` int DEFAULT NULL,
  PRIMARY KEY (`alert_assoc_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `alert_contacts`
--

DROP TABLE IF EXISTS `alert_contacts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `alert_contacts` (
  `contact_id` int NOT NULL AUTO_INCREMENT,
  `contact_descr` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `contact_method` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `contact_endpoint` text CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `contact_disabled` tinyint(1) NOT NULL DEFAULT '0',
  `contact_disabled_until` int DEFAULT NULL,
  `contact_message_custom` tinyint(1) NOT NULL DEFAULT '0',
  `contact_message_template` text CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci,
  PRIMARY KEY (`contact_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `alert_contacts_assoc`
--

DROP TABLE IF EXISTS `alert_contacts_assoc`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `alert_contacts_assoc` (
  `aca_id` int NOT NULL AUTO_INCREMENT,
  `aca_type` enum('alert','syslog') CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL DEFAULT 'alert',
  `alert_checker_id` int NOT NULL,
  `contact_id` int NOT NULL,
  PRIMARY KEY (`aca_id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `alert_log`
--

DROP TABLE IF EXISTS `alert_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `alert_log` (
  `event_id` int NOT NULL AUTO_INCREMENT,
  `alert_test_id` int DEFAULT NULL,
  `device_id` int NOT NULL DEFAULT '0',
  `timestamp` datetime DEFAULT NULL,
  `message` text CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci,
  `entity_type` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `entity_id` int NOT NULL,
  `log_type` enum('ALERT_NOTIFY','REMINDER_NOTIFY','FAIL','FAIL_DELAYED','FAIL_SUPPRESSED','OK','RECOVER_NOTIFY','RECOVER_SUPPRESSED') CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `notified` tinyint(1) NOT NULL DEFAULT '0',
  `log_state` varchar(512) COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`event_id`),
  KEY `type` (`entity_type`),
  KEY `device_id` (`device_id`),
  KEY `timestamp` (`timestamp`),
  KEY `entity` (`entity_type`,`entity_id`),
  KEY `alert_device` (`alert_test_id`,`device_id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `alert_table`
--

DROP TABLE IF EXISTS `alert_table`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `alert_table` (
  `alert_table_id` int NOT NULL AUTO_INCREMENT,
  `alert_test_id` int NOT NULL,
  `device_id` int NOT NULL,
  `entity_type` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `entity_id` int NOT NULL,
  `alert_assocs` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `delay` int NOT NULL,
  `ignore_until` datetime DEFAULT NULL,
  `ignore_until_ok` tinyint(1) DEFAULT NULL,
  `last_checked` int DEFAULT NULL,
  `last_changed` int DEFAULT NULL,
  `last_recovered` int DEFAULT NULL,
  `last_ok` int DEFAULT NULL,
  `last_failed` int DEFAULT NULL,
  `has_alerted` tinyint(1) NOT NULL,
  `last_message` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `alert_status` tinyint NOT NULL DEFAULT '-1',
  `last_alerted` int NOT NULL,
  `state` varchar(512) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `count` int NOT NULL,
  PRIMARY KEY (`alert_table_id`),
  UNIQUE KEY `alert_id_2` (`alert_test_id`,`entity_type`,`entity_id`),
  KEY `device_id` (`device_id`),
  KEY `alert_cache` (`alert_table_id`,`alert_test_id`,`device_id`,`entity_type`,`entity_id`,`alert_status`)
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `alert_tests`
--

DROP TABLE IF EXISTS `alert_tests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `alert_tests` (
  `alert_test_id` int NOT NULL AUTO_INCREMENT,
  `entity_type` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `alert_name` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `alert_message` text CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `alert_assoc` text CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci,
  `conditions` text CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `conditions_warn` text CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci,
  `and` tinyint(1) NOT NULL DEFAULT '1',
  `severity` enum('crit','warn','info') CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL DEFAULT 'crit',
  `delay` int DEFAULT '0',
  `alerter` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `enable` tinyint(1) NOT NULL DEFAULT '1',
  `show_frontpage` int NOT NULL DEFAULT '1',
  `suppress_recovery` tinyint(1) DEFAULT '0',
  `ignore_until` datetime DEFAULT NULL,
  PRIMARY KEY (`alert_test_id`),
  UNIQUE KEY `alert_name` (`alert_name`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `alerts_maint`
--

DROP TABLE IF EXISTS `alerts_maint`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `alerts_maint` (
  `maint_id` int NOT NULL AUTO_INCREMENT,
  `maint_name` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `maint_descr` text CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `maint_start` int NOT NULL,
  `maint_end` int NOT NULL,
  `maint_global` tinyint(1) NOT NULL DEFAULT '0',
  `maint_interval` enum('daily','weekly','monthly') CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `maint_interval_count` int NOT NULL DEFAULT '1',
  PRIMARY KEY (`maint_id`),
  KEY `maint_cache` (`maint_start`,`maint_end`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `alerts_maint_assoc`
--

DROP TABLE IF EXISTS `alerts_maint_assoc`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `alerts_maint_assoc` (
  `maint_assoc_id` int NOT NULL AUTO_INCREMENT,
  `maint_id` int NOT NULL,
  `entity_type` varchar(16) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `entity_id` int NOT NULL,
  PRIMARY KEY (`maint_assoc_id`),
  UNIQUE KEY `unique` (`maint_id`,`entity_type`,`entity_id`),
  KEY `maint_id` (`maint_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `applications`
--

DROP TABLE IF EXISTS `applications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `applications` (
  `app_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `app_type` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `app_instance` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `app_state` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL DEFAULT 'UNKNOWN',
  `app_name` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `app_lastpolled` int NOT NULL DEFAULT '0',
  `app_json` text CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci COMMENT 'JSON array of application data',
  PRIMARY KEY (`app_id`),
  UNIQUE KEY `dev_type_inst` (`device_id`,`app_type`,`app_instance`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `authlog`
--

DROP TABLE IF EXISTS `authlog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `authlog` (
  `id` int NOT NULL AUTO_INCREMENT,
  `datetime` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `user` text CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `address` text CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `user_agent` text CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci,
  `result` text CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8281 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `autodiscovery`
--

DROP TABLE IF EXISTS `autodiscovery`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `autodiscovery` (
  `autodiscovery_id` int NOT NULL AUTO_INCREMENT,
  `poller_id` int NOT NULL,
  `device_id` int DEFAULT NULL,
  `remote_hostname` varchar(253) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `remote_ip` varchar(128) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `remote_device_id` int DEFAULT NULL,
  `protocol` varchar(11) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `added` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `last_checked` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `last_reason` enum('ok','no_xdp','no_fqdn','no_dns','no_ip_permit','no_ping','no_snmp','no_db','duplicated','unknown') CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  PRIMARY KEY (`autodiscovery_id`),
  KEY `remote_hostname_ip` (`poller_id`,`remote_hostname`,`remote_ip`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `backup_job_devices`
--

DROP TABLE IF EXISTS `backup_job_devices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `backup_job_devices` (
  `job_id` int NOT NULL,
  `device_id` int NOT NULL,
  PRIMARY KEY (`job_id`,`device_id`),
  KEY `device_id` (`device_id`),
  CONSTRAINT `backup_job_devices_ibfk_1` FOREIGN KEY (`job_id`) REFERENCES `backup_jobs` (`job_id`) ON DELETE CASCADE,
  CONSTRAINT `backup_job_devices_ibfk_2` FOREIGN KEY (`device_id`) REFERENCES `devices` (`device_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `backup_job_logs`
--

DROP TABLE IF EXISTS `backup_job_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `backup_job_logs` (
  `log_id` int NOT NULL AUTO_INCREMENT,
  `job_id` int NOT NULL,
  `device_id` int NOT NULL,
  `status` enum('success','failed','running') NOT NULL,
  `backup_id` int DEFAULT NULL,
  `message` text,
  `start_time` datetime DEFAULT CURRENT_TIMESTAMP,
  `end_time` datetime DEFAULT NULL,
  `duration` int DEFAULT NULL,
  PRIMARY KEY (`log_id`),
  KEY `device_id` (`device_id`),
  KEY `backup_id` (`backup_id`),
  KEY `job_id_idx` (`job_id`),
  KEY `status_idx` (`status`),
  KEY `start_time_idx` (`start_time`),
  CONSTRAINT `backup_job_logs_ibfk_1` FOREIGN KEY (`job_id`) REFERENCES `backup_jobs` (`job_id`) ON DELETE CASCADE,
  CONSTRAINT `backup_job_logs_ibfk_2` FOREIGN KEY (`device_id`) REFERENCES `devices` (`device_id`) ON DELETE CASCADE,
  CONSTRAINT `backup_job_logs_ibfk_3` FOREIGN KEY (`backup_id`) REFERENCES `device_config_backups` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=50 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `backup_jobs`
--

DROP TABLE IF EXISTS `backup_jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `backup_jobs` (
  `job_id` int NOT NULL AUTO_INCREMENT,
  `job_name` varchar(100) NOT NULL,
  `device_id` int DEFAULT NULL,
  `config_type` varchar(50) DEFAULT 'running',
  `schedule_type` enum('once','daily','weekly','monthly') NOT NULL,
  `schedule_time` time DEFAULT NULL,
  `schedule_day` int DEFAULT NULL,
  `enabled` tinyint(1) DEFAULT '1',
  `last_run` datetime DEFAULT NULL,
  `next_run` datetime DEFAULT NULL,
  `retention_days` int DEFAULT '365',
  `notify_on_failure` tinyint(1) DEFAULT '1',
  `created_by` int NOT NULL,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_date` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`job_id`),
  KEY `device_id_idx` (`device_id`),
  KEY `enabled_idx` (`enabled`),
  KEY `next_run_idx` (`next_run`),
  CONSTRAINT `backup_jobs_ibfk_1` FOREIGN KEY (`device_id`) REFERENCES `devices` (`device_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `bgpPeers`
--

DROP TABLE IF EXISTS `bgpPeers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bgpPeers` (
  `bgpPeer_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `local_as` int unsigned DEFAULT NULL,
  `astext` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `reverse_dns` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `virtual_name` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `peer_device_id` int unsigned DEFAULT NULL,
  `bgpPeerIdentifier` varchar(39) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `bgpPeerRemoteAs` int unsigned NOT NULL,
  `bgpPeerState` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '',
  `bgpPeerAdminStatus` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '',
  `bgpPeerLocalAddr` varchar(39) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `bgpPeerRemoteAddr` varchar(39) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `bgpPeer_polled` int NOT NULL,
  `bgpPeerInUpdates` int DEFAULT NULL,
  `bgpPeerOutUpdates` int DEFAULT NULL,
  `bgpPeerInTotalMessages` int DEFAULT NULL,
  `bgpPeerOutTotalMessages` int DEFAULT NULL,
  `bgpPeerFsmEstablishedTime` int DEFAULT NULL,
  `bgpPeerInUpdateElapsedTime` int DEFAULT NULL,
  `bgpPeerInUpdates_delta` int DEFAULT NULL,
  `bgpPeerInUpdates_rate` int DEFAULT NULL,
  `bgpPeerOutUpdates_delta` int DEFAULT NULL,
  `bgpPeerOutUpdates_rate` int DEFAULT NULL,
  `bgpPeerInTotalMessages_delta` int DEFAULT NULL,
  `bgpPeerInTotalMessages_rate` int DEFAULT NULL,
  `bgpPeerOutTotalMessages_delta` int DEFAULT NULL,
  `bgpPeerOutTotalMessages_rate` int DEFAULT NULL,
  PRIMARY KEY (`bgpPeer_id`),
  KEY `device_id` (`device_id`),
  KEY `bgp_cache` (`bgpPeer_id`,`device_id`,`bgpPeerState`,`bgpPeerAdminStatus`,`bgpPeerRemoteAs`),
  KEY `bgp_local_peer` (`device_id`,`bgpPeerLocalAddr`),
  KEY `bgp_remote_peer` (`device_id`,`bgpPeerRemoteAs`,`bgpPeerRemoteAddr`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `bgpPeers_cbgp`
--

DROP TABLE IF EXISTS `bgpPeers_cbgp`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bgpPeers_cbgp` (
  `cbgp_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `bgpPeer_id` int NOT NULL,
  `bgpPeerIndex` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `afi` varchar(16) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `safi` varchar(16) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `AcceptedPrefixes` int DEFAULT NULL,
  `DeniedPrefixes` int DEFAULT NULL,
  `PrefixAdminLimit` int DEFAULT NULL,
  `PrefixThreshold` int DEFAULT NULL,
  `PrefixClearThreshold` int DEFAULT NULL,
  `AdvertisedPrefixes` int DEFAULT NULL,
  `SuppressedPrefixes` int DEFAULT NULL,
  `WithdrawnPrefixes` int DEFAULT NULL,
  PRIMARY KEY (`cbgp_id`),
  UNIQUE KEY `unique_index` (`bgpPeer_id`,`device_id`,`afi`,`safi`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `bill_data`
--

DROP TABLE IF EXISTS `bill_data`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bill_data` (
  `bill_data_id` int NOT NULL AUTO_INCREMENT,
  `bill_id` int NOT NULL,
  `timestamp` datetime NOT NULL,
  `period` int NOT NULL,
  `delta` bigint NOT NULL,
  `in_delta` bigint NOT NULL,
  `out_delta` bigint NOT NULL,
  PRIMARY KEY (`bill_data_id`),
  KEY `bill_id` (`bill_id`,`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `bill_entities`
--

DROP TABLE IF EXISTS `bill_entities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bill_entities` (
  `bill_ent_id` int NOT NULL AUTO_INCREMENT,
  `bill_id` int NOT NULL,
  `entity_id` int NOT NULL,
  `bill_port_autoadded` tinyint(1) NOT NULL DEFAULT '0',
  `bill_port_polled` int NOT NULL,
  `bill_port_period` int NOT NULL,
  `bill_port_counter_in` bigint DEFAULT NULL,
  `bill_port_delta_in` bigint DEFAULT NULL,
  `bill_port_counter_out` bigint DEFAULT NULL,
  `bill_port_delta_out` bigint DEFAULT NULL,
  `entity_type` varchar(20) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL DEFAULT 'port',
  PRIMARY KEY (`bill_ent_id`),
  UNIQUE KEY `bill_id_2` (`bill_id`,`entity_id`),
  KEY `bill_id` (`bill_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `bill_history`
--

DROP TABLE IF EXISTS `bill_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bill_history` (
  `bill_hist_id` int NOT NULL AUTO_INCREMENT,
  `bill_id` int NOT NULL,
  `updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `bill_datefrom` datetime NOT NULL,
  `bill_dateto` datetime NOT NULL,
  `bill_type` text NOT NULL,
  `bill_allowed` bigint NOT NULL,
  `bill_used` bigint NOT NULL,
  `bill_overuse` bigint NOT NULL,
  `bill_percent` decimal(10,2) NOT NULL,
  `rate_95th_in` bigint NOT NULL,
  `rate_95th_out` bigint NOT NULL,
  `rate_95th` bigint NOT NULL,
  `dir_95th` varchar(3) NOT NULL,
  `rate_average` bigint NOT NULL,
  `rate_average_in` bigint NOT NULL,
  `rate_average_out` bigint NOT NULL,
  `traf_in` bigint NOT NULL,
  `traf_out` bigint NOT NULL,
  `traf_total` bigint NOT NULL,
  `pdf` longblob,
  PRIMARY KEY (`bill_hist_id`),
  UNIQUE KEY `unique_index` (`bill_id`,`bill_datefrom`,`bill_dateto`),
  KEY `bill_id` (`bill_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `bills`
--

DROP TABLE IF EXISTS `bills`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bills` (
  `bill_id` int NOT NULL AUTO_INCREMENT,
  `bill_name` text CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `bill_type` text CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `bill_cdr` bigint DEFAULT NULL,
  `bill_day` int NOT NULL DEFAULT '1',
  `bill_quota` bigint DEFAULT NULL,
  `bill_polled` int NOT NULL,
  `rate_95th_in` bigint NOT NULL,
  `rate_95th_out` bigint NOT NULL,
  `rate_95th` bigint NOT NULL,
  `dir_95th` varchar(3) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `total_data` bigint NOT NULL,
  `total_data_in` bigint NOT NULL,
  `total_data_out` bigint NOT NULL,
  `rate_average_in` bigint NOT NULL,
  `rate_average_out` bigint NOT NULL,
  `rate_average` bigint NOT NULL,
  `bill_last_calc` datetime NOT NULL,
  `bill_custid` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `bill_contact` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `bill_threshold` int DEFAULT NULL,
  `bill_notify` tinyint(1) NOT NULL DEFAULT '0',
  `bill_ref` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `bill_notes` varchar(256) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `bill_autoadded` tinyint(1) NOT NULL DEFAULT '0',
  UNIQUE KEY `bill_id` (`bill_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `cef_prefix`
--

DROP TABLE IF EXISTS `cef_prefix`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cef_prefix` (
  `cef_pfx_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `entPhysicalIndex` int NOT NULL,
  `afi` varchar(4) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `cef_pfx` int NOT NULL,
  PRIMARY KEY (`cef_pfx_id`),
  KEY `cef_cache` (`device_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `cef_switching`
--

DROP TABLE IF EXISTS `cef_switching`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cef_switching` (
  `cef_switching_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `entPhysicalIndex` int NOT NULL,
  `afi` varchar(4) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `cef_index` int NOT NULL,
  `cef_path` varchar(16) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `drop` int NOT NULL,
  `punt` int NOT NULL,
  `punt2host` int NOT NULL,
  `drop_prev` int NOT NULL,
  `punt_prev` int NOT NULL,
  `punt2host_prev` int NOT NULL,
  `updated` int NOT NULL,
  `updated_prev` int NOT NULL,
  PRIMARY KEY (`cef_switching_id`),
  UNIQUE KEY `device_id` (`device_id`,`entPhysicalIndex`,`afi`,`cef_index`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `chat_history`
--

DROP TABLE IF EXISTS `chat_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chat_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `role` enum('user','ai') NOT NULL,
  `message` text NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `session_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `session_id_idx` (`session_id`)
) ENGINE=InnoDB AUTO_INCREMENT=113 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `chat_sessions`
--

DROP TABLE IF EXISTS `chat_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chat_sessions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `title` varchar(255) DEFAULT 'Nouveau chat',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id_idx` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `config`
--

DROP TABLE IF EXISTS `config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `config` (
  `config_key` varchar(255) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `config_value` text CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `last_change` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`config_key`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `config_change_history`
--

DROP TABLE IF EXISTS `config_change_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `config_change_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `backup_id` int NOT NULL,
  `change_type` enum('ADDED','MODIFIED','REMOVED') NOT NULL,
  `change_path` varchar(500) DEFAULT NULL,
  `old_value` text,
  `new_value` text,
  `change_date` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `backup_id_idx` (`backup_id`),
  KEY `change_type_idx` (`change_type`),
  KEY `change_date_idx` (`change_date`),
  CONSTRAINT `config_change_history_ibfk_1` FOREIGN KEY (`backup_id`) REFERENCES `device_config_backups` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `counters`
--

DROP TABLE IF EXISTS `counters`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `counters` (
  `counter_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `poller_type` enum('snmp','agent','ipmi') CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL DEFAULT 'snmp',
  `counter_class` varchar(64) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `counter_oid` varchar(255) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `counter_mib` varchar(64) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `counter_object` varchar(64) CHARACTER SET latin1 COLLATE latin1_general_cs DEFAULT NULL,
  `counter_index` varchar(128) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `counter_descr` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `counter_unit` varchar(16) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `counter_multiplier` float NOT NULL DEFAULT '1',
  `counter_limit` float DEFAULT NULL,
  `counter_limit_warn` float DEFAULT NULL,
  `counter_limit_low` float DEFAULT NULL,
  `counter_limit_low_warn` float DEFAULT NULL,
  `counter_limit_by` enum('sec','min','5min','hour','value') CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL DEFAULT '5min',
  `counter_custom_limit` tinyint(1) NOT NULL DEFAULT '0',
  `entPhysicalIndex_measured` varchar(16) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `measured_class` varchar(16) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `measured_entity` int unsigned DEFAULT NULL,
  `measured_entity_label` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `entPhysicalIndex` varchar(16) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `entPhysicalClass` varchar(32) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `counter_ignore` tinyint(1) NOT NULL DEFAULT '0',
  `counter_disable` tinyint(1) NOT NULL DEFAULT '0',
  `counter_deleted` tinyint(1) NOT NULL DEFAULT '0',
  `counter_value` double(32,16) DEFAULT NULL,
  `counter_rate` float(14,5) DEFAULT NULL,
  `counter_rate_5min` float(14,5) DEFAULT NULL,
  `counter_rate_hour` float(14,5) DEFAULT NULL,
  `counter_history` text CHARACTER SET latin1 COLLATE latin1_general_ci,
  `counter_event` enum('ok','warning','alert','ignore') CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL DEFAULT 'ignore',
  `counter_status` varchar(64) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `counter_polled` int DEFAULT NULL,
  `counter_last_change` int DEFAULT NULL,
  PRIMARY KEY (`counter_id`),
  KEY `counter_device` (`device_id`),
  KEY `counter_class` (`counter_class`),
  KEY `counter_oid` (`counter_oid`),
  KEY `counter_cache` (`counter_id`,`device_id`,`counter_class`,`counter_ignore`,`counter_disable`),
  CONSTRAINT `counter_devices` FOREIGN KEY (`device_id`) REFERENCES `devices` (`device_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `customers`
--

DROP TABLE IF EXISTS `customers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customers` (
  `customer_id` int NOT NULL AUTO_INCREMENT,
  `username` char(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `password` char(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `string` char(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `level` tinyint NOT NULL DEFAULT '0',
  PRIMARY KEY (`customer_id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `dash_widgets`
--

DROP TABLE IF EXISTS `dash_widgets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dash_widgets` (
  `widget_id` int NOT NULL AUTO_INCREMENT,
  `dash_id` int NOT NULL,
  `widget_type` varchar(32) NOT NULL,
  `widget_config` text NOT NULL,
  `x` int DEFAULT NULL,
  `y` int DEFAULT NULL,
  `width` int NOT NULL,
  `height` int NOT NULL,
  PRIMARY KEY (`widget_id`)
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `dashboards`
--

DROP TABLE IF EXISTS `dashboards`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dashboards` (
  `dash_id` int NOT NULL AUTO_INCREMENT,
  `dash_name` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  PRIMARY KEY (`dash_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `device_config_backups`
--

DROP TABLE IF EXISTS `device_config_backups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `device_config_backups` (
  `id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `hostname` varchar(45) NOT NULL,
  `config_type` varchar(50) NOT NULL,
  `config_data` mediumtext NOT NULL,
  `config_hash` varchar(64) NOT NULL,
  `version_name` varchar(100) DEFAULT NULL,
  `backup_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `change_detected` tinyint(1) DEFAULT '0',
  `change_description` text,
  PRIMARY KEY (`id`),
  KEY `device_id_idx` (`device_id`),
  KEY `backup_date_idx` (`backup_date`),
  KEY `config_hash_idx` (`config_hash`),
  KEY `config_type_idx` (`config_type`),
  CONSTRAINT `device_config_backups_ibfk_1` FOREIGN KEY (`device_id`) REFERENCES `devices` (`device_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=54 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `device_graphs`
--

DROP TABLE IF EXISTS `device_graphs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `device_graphs` (
  `device_graph_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `graph` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `enabled` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`device_graph_id`),
  KEY `device_id` (`device_id`),
  KEY `graph` (`graph`)
) ENGINE=InnoDB AUTO_INCREMENT=378 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `devices`
--

DROP TABLE IF EXISTS `devices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `devices` (
  `device_id` int NOT NULL AUTO_INCREMENT,
  `poller_id` int NOT NULL DEFAULT '0',
  `hostname` varchar(253) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `sysName` varchar(253) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `label` varchar(253) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `ip` varchar(128) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `snmp_community` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `snmp_authlevel` enum('noAuthNoPriv','authNoPriv','authPriv') CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `snmp_authname` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `snmp_authpass` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `snmp_authalgo` enum('MD5','SHA','SHA-224','SHA-256','SHA-384','SHA-512') CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `snmp_cryptopass` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `snmp_cryptoalgo` enum('DES','AES','AES-192','AES-192-C','AES-256','AES-256-C') CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `snmp_context` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `snmpable` text CHARACTER SET latin1 COLLATE latin1_general_ci,
  `snmp_version` enum('v1','v2c','v3') CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL DEFAULT 'v2c',
  `snmp_port` smallint unsigned NOT NULL DEFAULT '161',
  `snmp_timeout` int DEFAULT NULL,
  `snmp_retries` int DEFAULT NULL,
  `snmp_maxrep` int DEFAULT NULL,
  `ssh_port` int NOT NULL DEFAULT '22',
  `agent_version` int DEFAULT NULL,
  `snmp_transport` enum('udp','tcp','udp6','tcp6') CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL DEFAULT 'udp',
  `bgpLocalAs` int unsigned DEFAULT NULL,
  `snmpEngineID` varchar(255) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `sysObjectID` varchar(255) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `sysDescr` text CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci,
  `sysContact` text CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci,
  `version` text CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci,
  `hardware` text CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci,
  `vendor` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL COMMENT 'Hardware vendor',
  `features` text CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci,
  `location` text CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci,
  `os` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `status` tinyint NOT NULL DEFAULT '0',
  `status_type` enum('ping','snmp','dns','ok') CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL DEFAULT 'ok',
  `ignore` tinyint NOT NULL DEFAULT '0',
  `ignore_until` datetime DEFAULT NULL,
  `asset_tag` varchar(32) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `disabled` tinyint(1) NOT NULL DEFAULT '0',
  `uptime` int unsigned DEFAULT NULL,
  `last_rebooted` int unsigned DEFAULT NULL,
  `force_discovery` tinyint(1) NOT NULL DEFAULT '0',
  `last_polled` timestamp NULL DEFAULT NULL,
  `last_discovered` timestamp NULL DEFAULT NULL,
  `last_alerter` timestamp NULL DEFAULT NULL,
  `last_polled_timetaken` double(5,2) DEFAULT NULL,
  `last_discovered_timetaken` double(5,2) DEFAULT NULL,
  `purpose` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `type` varchar(20) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `serial` varchar(128) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `icon` varchar(255) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `device_state` text CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci,
  `distro` varchar(32) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `distro_ver` varchar(32) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `kernel` varchar(64) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `arch` varchar(8) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `vault_path` varchar(255) COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`device_id`),
  UNIQUE KEY `hostname` (`hostname`) USING BTREE,
  KEY `status` (`status`),
  KEY `sysName` (`sysName`),
  KEY `os` (`os`),
  KEY `ignore` (`ignore`),
  KEY `disabled_lastpolled` (`disabled`,`last_polled_timetaken`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `devices_locations`
--

DROP TABLE IF EXISTS `devices_locations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `devices_locations` (
  `location_id` int unsigned NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `location` text CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci,
  `location_lat` decimal(10,7) DEFAULT NULL,
  `location_lon` decimal(10,7) DEFAULT NULL,
  `location_country` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `location_state` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `location_county` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `location_city` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `location_geoapi` varchar(16) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `location_status` text CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci,
  `location_manual` tinyint(1) NOT NULL DEFAULT '0',
  `location_updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`location_id`),
  UNIQUE KEY `device_id` (`device_id`)
) ENGINE=InnoDB AUTO_INCREMENT=35 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci COMMENT='Stores geo location information';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `devices_mibs`
--

DROP TABLE IF EXISTS `devices_mibs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `devices_mibs` (
  `mib_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `mib` varchar(128) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL COMMENT 'Latin charset for 1byte chars!',
  `object` text CHARACTER SET latin1 COLLATE latin1_general_cs COMMENT 'Table or Object or Numeric. Latin charset for 1byte chars!',
  `use` enum('mib','object') CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `disabled` tinyint(1) NOT NULL DEFAULT '0',
  `updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`mib_id`),
  UNIQUE KEY `mib_object` (`device_id`,`mib`,`object`(512)),
  CONSTRAINT `mibs_devices` FOREIGN KEY (`device_id`) REFERENCES `devices` (`device_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COMMENT='Stores disabled MIBs or combination MIB with tables/oids';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `eigrp_ases`
--

DROP TABLE IF EXISTS `eigrp_ases`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `eigrp_ases` (
  `eigrp_as_id` int NOT NULL AUTO_INCREMENT,
  `eigrp_vpn` int NOT NULL,
  `eigrp_as` int NOT NULL,
  `device_id` int NOT NULL,
  `cEigrpNbrCount` int NOT NULL,
  `cEigrpAsRouterIdType` enum('unknown','ipv4','ipv6','ipv4z','ipv6z','dns') CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL DEFAULT 'ipv4',
  `cEigrpAsRouterId` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `cEigrpTopoRoutes` int NOT NULL,
  PRIMARY KEY (`eigrp_as_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `eigrp_peers`
--

DROP TABLE IF EXISTS `eigrp_peers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `eigrp_peers` (
  `eigrp_peer_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `eigrp_vpn` int NOT NULL,
  `eigrp_as` int NOT NULL,
  `peer_addrtype` enum('unknown','ipv4','ipv6','ipv4z','ipv6z','dns') CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL COMMENT 'inetAddrType',
  `peer_addr` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `peer_ifindex` int NOT NULL,
  `peer_holdtime` int NOT NULL,
  `peer_uptime` int NOT NULL,
  `peer_srtt` int NOT NULL,
  `peer_rto` int NOT NULL,
  `peer_version` varchar(20) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`eigrp_peer_id`),
  UNIQUE KEY `table_unique` (`device_id`,`eigrp_vpn`,`eigrp_as`,`peer_addr`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `eigrp_ports`
--

DROP TABLE IF EXISTS `eigrp_ports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `eigrp_ports` (
  `eigrp_port_id` int NOT NULL AUTO_INCREMENT,
  `eigrp_vpn` int NOT NULL,
  `eigrp_as` int NOT NULL,
  `eigrp_ifIndex` int NOT NULL,
  `port_id` int NOT NULL,
  `device_id` int NOT NULL,
  `eigrp_peer_count` int NOT NULL,
  `eigrp_MeanSrtt` int NOT NULL,
  `eigrp_authmode` text CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  PRIMARY KEY (`eigrp_port_id`),
  UNIQUE KEY `eigrp_vpn` (`eigrp_vpn`,`eigrp_as`,`eigrp_ifIndex`,`device_id`),
  KEY `device_id` (`device_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `eigrp_vpns`
--

DROP TABLE IF EXISTS `eigrp_vpns`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `eigrp_vpns` (
  `eigrp_vpn_id` int NOT NULL AUTO_INCREMENT,
  `eigrp_vpn` int NOT NULL,
  `eigrp_vpn_name` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `device_id` int NOT NULL,
  PRIMARY KEY (`eigrp_vpn_id`),
  KEY `device_id` (`device_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `entPhysical`
--

DROP TABLE IF EXISTS `entPhysical`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `entPhysical` (
  `entPhysical_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `inventory_mib` varchar(64) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `entPhysicalIndex` bigint NOT NULL,
  `entPhysicalDescr` text CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `entPhysicalClass` text CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `entPhysicalName` text CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `entPhysicalHardwareRev` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `entPhysicalFirmwareRev` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `entPhysicalSoftwareRev` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `entPhysicalAlias` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `entPhysicalAssetID` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `entPhysicalIsFRU` varchar(8) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `entPhysicalModelName` text CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `entPhysicalVendorType` text CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci,
  `entPhysicalSerialNum` text CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `entPhysicalContainedIn` bigint DEFAULT NULL,
  `entPhysicalParentRelPos` int DEFAULT NULL,
  `entPhysicalMfgName` text CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `ifIndex` int DEFAULT NULL,
  `deleted` datetime DEFAULT NULL,
  PRIMARY KEY (`entPhysical_id`),
  KEY `device_id` (`device_id`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `entPhysical-state`
--

DROP TABLE IF EXISTS `entPhysical-state`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `entPhysical-state` (
  `entPhysical_state_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `entPhysicalIndex` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `subindex` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `group` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `key` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `value` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  PRIMARY KEY (`entPhysical_state_id`),
  KEY `device_id_index` (`device_id`,`entPhysicalIndex`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `entity_attribs`
--

DROP TABLE IF EXISTS `entity_attribs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `entity_attribs` (
  `attrib_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int DEFAULT NULL,
  `entity_type` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `entity_id` int NOT NULL,
  `attrib_type` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `attrib_value` text CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`attrib_id`),
  KEY `attribs_cache` (`entity_type`,`entity_id`,`attrib_type`(50)),
  KEY `device_id` (`device_id`)
) ENGINE=InnoDB AUTO_INCREMENT=82 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `entity_permissions`
--

DROP TABLE IF EXISTS `entity_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `entity_permissions` (
  `perm_id` int NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `auth_mechanism` varchar(11) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `entity_type` varchar(32) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `entity_id` int NOT NULL,
  `access` enum('ro','rw') CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL DEFAULT 'ro',
  PRIMARY KEY (`perm_id`),
  UNIQUE KEY `user_auth` (`user_id`,`auth_mechanism`,`entity_id`,`entity_type`),
  KEY `user_id` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `eventlog`
--

DROP TABLE IF EXISTS `eventlog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `eventlog` (
  `event_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL DEFAULT '0',
  `timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `message` text CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci,
  `entity_type` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `entity_id` int DEFAULT NULL,
  `severity` tinyint NOT NULL DEFAULT '6',
  PRIMARY KEY (`event_id`),
  KEY `host` (`device_id`),
  KEY `datetime` (`timestamp`),
  KEY `host_2` (`device_id`,`timestamp`),
  KEY `type` (`entity_type`),
  KEY `type_device` (`entity_type`,`device_id`),
  KEY `eventlog_cache` (`device_id`,`entity_type`,`severity`),
  KEY `eventlog_entity` (`entity_type`,`entity_id`)
) ENGINE=InnoDB AUTO_INCREMENT=6001 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `group_table`
--

DROP TABLE IF EXISTS `group_table`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `group_table` (
  `group_table_id` int NOT NULL AUTO_INCREMENT,
  `group_id` int NOT NULL,
  `device_id` int NOT NULL,
  `entity_type` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `entity_id` int NOT NULL,
  `group_assocs` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  PRIMARY KEY (`group_table_id`),
  UNIQUE KEY `alert_id_2` (`group_id`,`entity_type`,`entity_id`),
  KEY `device_id` (`device_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `groups`
--

DROP TABLE IF EXISTS `groups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `groups` (
  `group_id` int NOT NULL AUTO_INCREMENT,
  `entity_type` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `group_name` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `group_descr` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `group_assoc` text CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci,
  `group_menu` tinyint(1) NOT NULL DEFAULT '0',
  `group_ignore` tinyint NOT NULL,
  `group_ignore_until` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`group_id`),
  UNIQUE KEY `group_name` (`group_name`),
  KEY `entity_type` (`entity_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `groups_assoc`
--

DROP TABLE IF EXISTS `groups_assoc`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `groups_assoc` (
  `group_assoc_id` int NOT NULL AUTO_INCREMENT,
  `group_id` int NOT NULL,
  `entity_type` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `device_attribs` text CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci,
  `entity_attribs` text CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci,
  PRIMARY KEY (`group_assoc_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `hrDevice`
--

DROP TABLE IF EXISTS `hrDevice`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `hrDevice` (
  `hrDevice_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `hrDeviceIndex` int NOT NULL,
  `hrDeviceDescr` text CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `hrDeviceType` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `hrDeviceErrors` int NOT NULL,
  `hrDeviceStatus` varchar(16) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `hrProcessorLoad` tinyint DEFAULT NULL,
  PRIMARY KEY (`hrDevice_id`),
  KEY `device_id` (`device_id`)
) ENGINE=InnoDB AUTO_INCREMENT=85 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ip_mac`
--

DROP TABLE IF EXISTS `ip_mac`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ip_mac` (
  `mac_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `port_id` int DEFAULT NULL,
  `mac_ifIndex` varchar(16) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `virtual_name` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `mac_address` char(12) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `ip_address` varchar(128) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `ip_version` tinyint NOT NULL,
  PRIMARY KEY (`mac_id`),
  KEY `port_id` (`port_id`),
  KEY `cache` (`device_id`,`port_id`)
) ENGINE=InnoDB AUTO_INCREMENT=430 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ipsec_tunnels`
--

DROP TABLE IF EXISTS `ipsec_tunnels`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ipsec_tunnels` (
  `tunnel_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `tunnel_index` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `tunnel_ike_index` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `peer_port` int NOT NULL,
  `peer_addr` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `local_addr` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `local_port` int NOT NULL,
  `tunnel_name` varchar(96) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `tunnel_status` varchar(11) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `tunnel_ike_alive` varchar(8) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `tunnel_lifetime` int DEFAULT NULL,
  `tunnel_ike_lifetime` int DEFAULT NULL,
  `tunnel_json` text CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci,
  `tunnel_endpoint` text CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci,
  `tunnel_endhash` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `tunnel_added` int DEFAULT NULL,
  `mib` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `tunnel_deleted` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`tunnel_id`),
  UNIQUE KEY `unique_index` (`device_id`,`local_addr`,`peer_addr`,`tunnel_endhash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ipv4_addresses`
--

DROP TABLE IF EXISTS `ipv4_addresses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ipv4_addresses` (
  `ipv4_address_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `ipv4_address` varchar(32) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `ipv4_binary` varbinary(4) DEFAULT NULL,
  `ipv4_prefixlen` int NOT NULL,
  `ipv4_type` varchar(16) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `ipv4_network_id` int NOT NULL,
  `vrf_id` int DEFAULT NULL,
  `port_id` int NOT NULL DEFAULT '0',
  `ifIndex` int DEFAULT NULL,
  PRIMARY KEY (`ipv4_address_id`),
  KEY `interface_id` (`port_id`),
  KEY `ipv4_address` (`ipv4_address`),
  KEY `device_id` (`device_id`),
  KEY `ipv4_cache` (`device_id`,`ipv4_address`),
  KEY `ipv4_binary` (`device_id`,`ipv4_binary`),
  KEY `ifIndex` (`ifIndex`)
) ENGINE=InnoDB AUTO_INCREMENT=168 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ipv4_networks`
--

DROP TABLE IF EXISTS `ipv4_networks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ipv4_networks` (
  `ipv4_network_id` int NOT NULL AUTO_INCREMENT,
  `ipv4_network` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  PRIMARY KEY (`ipv4_network_id`)
) ENGINE=InnoDB AUTO_INCREMENT=60 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ipv6_addresses`
--

DROP TABLE IF EXISTS `ipv6_addresses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ipv6_addresses` (
  `ipv6_address_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `ipv6_address` varchar(128) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `ipv6_binary` varbinary(16) DEFAULT NULL,
  `ipv6_compressed` varchar(128) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `ipv6_prefixlen` int NOT NULL,
  `ipv6_type` varchar(16) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `ipv6_origin` varchar(16) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `ipv6_network_id` int NOT NULL,
  `vrf_id` int DEFAULT NULL,
  `port_id` int NOT NULL DEFAULT '0',
  `ifIndex` int DEFAULT NULL,
  PRIMARY KEY (`ipv6_address_id`),
  KEY `interface_id` (`port_id`),
  KEY `device_id` (`device_id`),
  KEY `ipv6_binary` (`device_id`,`ipv6_binary`),
  KEY `ipv6_address` (`ipv6_address`,`ipv6_compressed`),
  KEY `ipv6_cache` (`device_id`,`ipv6_address`,`ipv6_compressed`),
  KEY `ifIndex` (`ifIndex`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ipv6_networks`
--

DROP TABLE IF EXISTS `ipv6_networks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ipv6_networks` (
  `ipv6_network_id` int NOT NULL AUTO_INCREMENT,
  `ipv6_network` varchar(132) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  PRIMARY KEY (`ipv6_network_id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `juniAtmVp`
--

DROP TABLE IF EXISTS `juniAtmVp`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `juniAtmVp` (
  `juniAtmVp_id` int NOT NULL AUTO_INCREMENT,
  `port_id` int NOT NULL,
  `vp_id` int NOT NULL,
  `vp_descr` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  PRIMARY KEY (`juniAtmVp_id`),
  KEY `port_id` (`port_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lb_pool_members`
--

DROP TABLE IF EXISTS `lb_pool_members`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lb_pool_members` (
  `member_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `member_name` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `pool_name` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `member_ip` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `member_port` int NOT NULL,
  `member_state` varchar(8) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `member_enabled` varchar(16) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `member_conns` int NOT NULL,
  `member_bps_in` int NOT NULL,
  `member_bps_out` int NOT NULL,
  PRIMARY KEY (`member_id`,`pool_name`),
  KEY `device_id` (`device_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lb_pools`
--

DROP TABLE IF EXISTS `lb_pools`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lb_pools` (
  `pool_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `pool_name` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `pool_lb` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `num_members` int NOT NULL,
  `active_members` int NOT NULL,
  `pool_conns` int NOT NULL,
  `pool_bps_in` int NOT NULL,
  `pool_bps_out` int NOT NULL,
  PRIMARY KEY (`pool_id`,`pool_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lb_snatpools`
--

DROP TABLE IF EXISTS `lb_snatpools`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lb_snatpools` (
  `snatpool_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `snatpool_name` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `snatpool_conns` int NOT NULL,
  PRIMARY KEY (`snatpool_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lb_virtuals`
--

DROP TABLE IF EXISTS `lb_virtuals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lb_virtuals` (
  `virt_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `virt_name` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `virt_ip` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `virt_mask` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `virt_port` int NOT NULL,
  `virt_proto` varchar(10) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `virt_type` varchar(16) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `virt_pool` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `virt_rules` varchar(256) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `virt_enabled` varchar(8) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `virt_state` varchar(16) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `virt_conns` int NOT NULL,
  `virt_bps_in` int NOT NULL,
  `virt_bps_out` int NOT NULL,
  PRIMARY KEY (`virt_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `loadbalancer_rservers`
--

DROP TABLE IF EXISTS `loadbalancer_rservers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `loadbalancer_rservers` (
  `rserver_id` int NOT NULL AUTO_INCREMENT,
  `rserver_index` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `device_id` int NOT NULL,
  `StateDescr` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `state` text CHARACTER SET utf8mb3 COLLATE utf8mb3_bin,
  PRIMARY KEY (`rserver_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `loadbalancer_vservers`
--

DROP TABLE IF EXISTS `loadbalancer_vservers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `loadbalancer_vservers` (
  `classmap_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `classmap` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `classmap_index` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `serverstate` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  PRIMARY KEY (`classmap_id`),
  KEY `device_id` (`device_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lsp`
--

DROP TABLE IF EXISTS `lsp`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lsp` (
  `lsp_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `lsp_mib` varchar(64) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `lsp_index` varchar(128) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `lsp_name` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `lsp_state` enum('unknown','up','down','notInService','backupActive') CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT 'unknown',
  `lsp_proto` varchar(32) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `lsp_uptime` int unsigned NOT NULL,
  `lsp_total_uptime` int unsigned NOT NULL,
  `lsp_primary_uptime` int unsigned NOT NULL,
  `lsp_polled` int unsigned NOT NULL,
  `lsp_octets` bigint NOT NULL,
  `lsp_octets_rate` bigint NOT NULL,
  `lsp_packets` bigint NOT NULL,
  `lsp_packets_rate` bigint NOT NULL,
  `lsp_bandwidth` bigint NOT NULL DEFAULT '0',
  `lsp_transitions` int NOT NULL,
  `lsp_path_changes` int NOT NULL,
  PRIMARY KEY (`lsp_id`),
  UNIQUE KEY `index_unique` (`device_id`,`lsp_mib`,`lsp_index`),
  KEY `device_id` (`device_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `mac_accounting`
--

DROP TABLE IF EXISTS `mac_accounting`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `mac_accounting` (
  `ma_id` int NOT NULL AUTO_INCREMENT,
  `port_id` int NOT NULL,
  `vlan_id` int NOT NULL DEFAULT '0',
  `device_id` int NOT NULL,
  `mac` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `bytes_input` bigint DEFAULT NULL,
  `bytes_input_delta` bigint DEFAULT NULL,
  `bytes_input_rate` int DEFAULT NULL,
  `bytes_output` bigint DEFAULT NULL,
  `bytes_output_delta` bigint DEFAULT NULL,
  `bytes_output_rate` int DEFAULT NULL,
  `pkts_input` bigint DEFAULT NULL,
  `pkts_input_delta` bigint DEFAULT NULL,
  `pkts_input_rate` int DEFAULT NULL,
  `pkts_output` bigint DEFAULT NULL,
  `pkts_output_delta` bigint DEFAULT NULL,
  `pkts_output_rate` int DEFAULT NULL,
  `poll_time` int DEFAULT NULL,
  `poll_period` int DEFAULT NULL,
  PRIMARY KEY (`ma_id`),
  UNIQUE KEY `port_vlan_mac` (`port_id`,`vlan_id`,`mac`),
  KEY `device_ma` (`device_id`,`ma_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `mempools`
--

DROP TABLE IF EXISTS `mempools`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `mempools` (
  `mempool_id` int NOT NULL AUTO_INCREMENT,
  `mempool_index` varchar(128) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `entPhysicalIndex` int DEFAULT NULL,
  `hrDeviceIndex` int DEFAULT NULL,
  `mempool_mib` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `mempool_multiplier` float(14,5) NOT NULL DEFAULT '1.00000',
  `mempool_hc` tinyint(1) NOT NULL DEFAULT '0',
  `mempool_descr` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `device_id` int NOT NULL,
  `mempool_deleted` tinyint(1) NOT NULL DEFAULT '0',
  `mempool_warn_limit` int DEFAULT NULL,
  `mempool_crit_limit` int DEFAULT NULL,
  `mempool_ignore` int DEFAULT NULL,
  `mempool_table` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `mempool_polled` int NOT NULL,
  `mempool_perc` int NOT NULL,
  `mempool_used` bigint NOT NULL,
  `mempool_free` bigint NOT NULL,
  `mempool_total` bigint NOT NULL,
  PRIMARY KEY (`mempool_id`),
  KEY `device_id` (`device_id`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `munin_plugins`
--

DROP TABLE IF EXISTS `munin_plugins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `munin_plugins` (
  `mplug_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `mplug_type` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `mplug_instance` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `mplug_category` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `mplug_title` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `mplug_info` text CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci,
  `mplug_vlabel` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `mplug_args` varchar(512) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `mplug_total` binary(1) NOT NULL DEFAULT '0',
  `mplug_graph` binary(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`mplug_id`),
  UNIQUE KEY `dev_mplug` (`device_id`,`mplug_type`),
  KEY `device_id` (`device_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `munin_plugins_ds`
--

DROP TABLE IF EXISTS `munin_plugins_ds`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `munin_plugins_ds` (
  `mplug_ds_id` int NOT NULL AUTO_INCREMENT,
  `mplug_id` int NOT NULL,
  `ds_name` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL,
  `ds_type` enum('COUNTER','ABSOLUTE','DERIVE','GAUGE') CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL DEFAULT 'GAUGE',
  `ds_label` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL,
  `ds_cdef` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL,
  `ds_draw` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL,
  `ds_graph` enum('no','yes') CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL DEFAULT 'yes',
  `ds_info` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL,
  `ds_extinfo` text CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL,
  `ds_max` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL,
  `ds_min` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL,
  `ds_negative` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL,
  `ds_warning` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL,
  `ds_critical` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL,
  `ds_colour` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL,
  `ds_sum` text CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL,
  `ds_stack` text CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL,
  `ds_line` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL,
  PRIMARY KEY (`mplug_ds_id`),
  UNIQUE KEY `splug_id` (`mplug_id`,`ds_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `neighbours`
--

DROP TABLE IF EXISTS `neighbours`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `neighbours` (
  `neighbour_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int DEFAULT '0',
  `port_id` int DEFAULT NULL,
  `remote_device_id` int DEFAULT NULL,
  `remote_port_id` int DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `autodiscovery_id` int DEFAULT NULL,
  `protocol` varchar(11) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `remote_hostname` varchar(253) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `remote_port` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `remote_platform` varchar(1024) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `remote_version` text CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci,
  `remote_address` varchar(128) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `last_change` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`neighbour_id`),
  KEY `src_if` (`port_id`),
  KEY `dst_if` (`remote_port_id`),
  KEY `count` (`port_id`,`active`),
  KEY `device_id` (`device_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `netmaps`
--

DROP TABLE IF EXISTS `netmaps`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `netmaps` (
  `netmap_id` int NOT NULL AUTO_INCREMENT,
  `name` char(64) NOT NULL,
  `info` mediumtext NOT NULL,
  PRIMARY KEY (`netmap_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `netscaler_servicegroupmembers`
--

DROP TABLE IF EXISTS `netscaler_servicegroupmembers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `netscaler_servicegroupmembers` (
  `svc_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `svc_name` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `svc_groupname` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `svc_fullname` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `svc_label` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `svc_ip` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `svc_port` int NOT NULL,
  `svc_type` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `svc_state` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `svc_clients` int NOT NULL,
  `svc_server` int NOT NULL,
  `svc_req_rate` int NOT NULL,
  `svc_bps_in` int NOT NULL,
  `svc_bps_out` int NOT NULL,
  `svc_ignore` tinyint(1) NOT NULL DEFAULT '0',
  `svc_ignore_until` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`svc_id`),
  KEY `device_id` (`device_id`,`svc_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `netscaler_services`
--

DROP TABLE IF EXISTS `netscaler_services`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `netscaler_services` (
  `svc_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `svc_name` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `svc_fullname` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `svc_label` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `svc_ip` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `svc_port` int NOT NULL,
  `svc_type` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `svc_state` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `svc_clients` int NOT NULL,
  `svc_server` int NOT NULL,
  `svc_req_rate` int NOT NULL,
  `svc_bps_in` int NOT NULL,
  `svc_bps_out` int NOT NULL,
  `svc_ignore` tinyint(1) NOT NULL DEFAULT '0',
  `svc_ignore_until` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`svc_id`),
  KEY `device_id` (`device_id`,`svc_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `netscaler_services_vservers`
--

DROP TABLE IF EXISTS `netscaler_services_vservers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `netscaler_services_vservers` (
  `sv_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `vsvr_name` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `svc_name` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `service_weight` int NOT NULL,
  PRIMARY KEY (`sv_id`),
  UNIQUE KEY `index` (`device_id`,`vsvr_name`,`svc_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `netscaler_vservers`
--

DROP TABLE IF EXISTS `netscaler_vservers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `netscaler_vservers` (
  `vsvr_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `vsvr_name` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `vsvr_fullname` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `vsvr_label` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `vsvr_ip` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `vsvr_ipv6` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `vsvr_port` int NOT NULL,
  `vsvr_type` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `vsvr_entitytype` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `vsvr_state` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `vsvr_clients` int NOT NULL,
  `vsvr_server` int NOT NULL,
  `vsvr_req_rate` int NOT NULL,
  `vsvr_bps_in` int NOT NULL,
  `vsvr_bps_out` int NOT NULL,
  `vsvr_ignore` tinyint(1) NOT NULL DEFAULT '0',
  `vsvr_ignore_until` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`vsvr_id`),
  KEY `device_id` (`device_id`,`vsvr_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `notifications_queue`
--

DROP TABLE IF EXISTS `notifications_queue`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications_queue` (
  `notification_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `device_id` int DEFAULT NULL,
  `log_id` int unsigned NOT NULL,
  `aca_type` enum('alert','syslog','web') CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `severity` tinyint NOT NULL DEFAULT '6',
  `endpoints` text NOT NULL,
  `endpoints_result` text,
  `message_tags` text NOT NULL,
  `message_graphs` blob,
  `notification_added` int NOT NULL,
  `notification_lifetime` int NOT NULL DEFAULT '300',
  `notification_entry` text,
  `notification_locked` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`notification_id`),
  KEY `aca_type` (`aca_type`),
  KEY `device_id` (`device_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `observium_actions`
--

DROP TABLE IF EXISTS `observium_actions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `observium_actions` (
  `action_id` int NOT NULL AUTO_INCREMENT,
  `poller_id` int NOT NULL,
  `action` varchar(32) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `identifier` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `vars` text CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci,
  `added` int unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`action_id`),
  UNIQUE KEY `ident` (`poller_id`,`action`,`identifier`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `observium_attribs`
--

DROP TABLE IF EXISTS `observium_attribs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `observium_attribs` (
  `attrib_type` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `attrib_value` mediumtext CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  PRIMARY KEY (`attrib_type`(50))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `observium_processes`
--

DROP TABLE IF EXISTS `observium_processes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `observium_processes` (
  `process_id` int unsigned NOT NULL AUTO_INCREMENT,
  `process_pid` int NOT NULL,
  `process_ppid` int NOT NULL,
  `process_uid` int NOT NULL,
  `process_command` text NOT NULL,
  `process_name` varchar(32) NOT NULL,
  `process_start` int NOT NULL,
  `device_id` int NOT NULL,
  `poller_id` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`process_id`),
  KEY `pid` (`process_pid`,`process_name`,`device_id`),
  KEY `name` (`process_name`,`device_id`)
) ENGINE=InnoDB AUTO_INCREMENT=134434 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `oids`
--

DROP TABLE IF EXISTS `oids`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `oids` (
  `oid_id` int NOT NULL AUTO_INCREMENT,
  `oid` varchar(1024) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `oid_type` varchar(8) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `oid_descr` varchar(256) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `oid_name` varchar(512) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `oid_unit` varchar(16) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `oid_symbol` varchar(8) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `oid_logy` tinyint(1) NOT NULL DEFAULT '0',
  `oid_kibi` tinyint(1) NOT NULL DEFAULT '0',
  `oid_autodiscover` tinyint(1) NOT NULL DEFAULT '1',
  `oid_thresh_scheme` varchar(16) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `oid_alert_low` bigint DEFAULT NULL,
  `oid_warn_low` bigint DEFAULT NULL,
  `oid_warn_high` bigint DEFAULT NULL,
  `oid_alert_high` bigint DEFAULT NULL,
  PRIMARY KEY (`oid_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `oids_entries`
--

DROP TABLE IF EXISTS `oids_entries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `oids_entries` (
  `oid_entry_id` int NOT NULL AUTO_INCREMENT,
  `oid_id` int NOT NULL,
  `device_id` int NOT NULL,
  `value` float NOT NULL,
  `timestamp` int NOT NULL,
  `raw_value` bigint NOT NULL,
  `event` enum('ok','warning','alert','ignore') CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL DEFAULT 'ignore',
  `deleted` tinyint(1) NOT NULL DEFAULT '0',
  `alert_low` bigint DEFAULT NULL,
  `warn_low` bigint DEFAULT NULL,
  `warn_high` bigint DEFAULT NULL,
  `alert_high` bigint DEFAULT NULL,
  PRIMARY KEY (`oid_entry_id`),
  UNIQUE KEY `oids_cache` (`oid_id`,`device_id`),
  KEY `device_id` (`device_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ospf_areas`
--

DROP TABLE IF EXISTS `ospf_areas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ospf_areas` (
  `ospf_area_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `ospfVersionNumber` enum('version2','version3') CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL DEFAULT 'version2',
  `ospfAreaId` varchar(32) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `ospfAuthType` varchar(64) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL DEFAULT 'none',
  `ospfImportAsExtern` varchar(128) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `ospfSpfRuns` int NOT NULL,
  `ospfAreaBdrRtrCount` int NOT NULL,
  `ospfAsBdrRtrCount` int NOT NULL,
  `ospfAreaLsaCount` int NOT NULL,
  `ospfAreaLsaCksumSum` int NOT NULL,
  `ospfAreaSummary` varchar(16) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `ospfAreaStatus` varchar(16) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  PRIMARY KEY (`ospf_area_id`),
  UNIQUE KEY `device_area` (`device_id`,`ospfVersionNumber`,`ospfAreaId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ospf_instances`
--

DROP TABLE IF EXISTS `ospf_instances`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ospf_instances` (
  `ospf_instance_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `ospfRouterId` varchar(32) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `ospfAdminStat` enum('enabled','disabled') CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL DEFAULT 'disabled',
  `ospfVersionNumber` enum('version2','version3') CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `ospfAreaBdrRtrStatus` enum('true','false') CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `ospfASBdrRtrStatus` enum('true','false') CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `ospfExternLsaCount` int NOT NULL,
  `ospfExternLsaCksumSum` int NOT NULL,
  `ospfTOSSupport` enum('true','false') CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `ospfOriginateNewLsas` int NOT NULL,
  `ospfRxNewLsas` int NOT NULL,
  `ospfExtLsdbLimit` int DEFAULT NULL,
  `ospfMulticastExtensions` int DEFAULT NULL,
  `ospfExitOverflowInterval` int DEFAULT NULL,
  `ospfDemandExtensions` enum('true','false') CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  PRIMARY KEY (`ospf_instance_id`),
  UNIQUE KEY `device` (`device_id`,`ospfVersionNumber`),
  KEY `ospf_cache` (`device_id`,`ospfAdminStat`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ospf_nbrs`
--

DROP TABLE IF EXISTS `ospf_nbrs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ospf_nbrs` (
  `ospf_nbrs_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `port_id` int NOT NULL,
  `ospfVersionNumber` enum('version2','version3') CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL DEFAULT 'version2',
  `ospf_nbr_id` varchar(32) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `ospfNbrIpAddr` varchar(128) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `ospfNbrAddressLessIndex` int NOT NULL,
  `ospfNbrRtrId` varchar(32) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `ospfNbrOptions` int NOT NULL,
  `ospfNbrPriority` int NOT NULL,
  `ospfNbrState` varchar(32) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `ospfNbrEvents` int NOT NULL,
  `ospfNbrLsRetransQLen` int NOT NULL,
  `ospfNbmaNbrStatus` varchar(32) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `ospfNbmaNbrPermanence` varchar(32) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `ospfNbrHelloSuppressed` varchar(32) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  PRIMARY KEY (`ospf_nbrs_id`),
  UNIQUE KEY `device_nbrs` (`device_id`,`ospfVersionNumber`,`ospf_nbr_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ospf_ports`
--

DROP TABLE IF EXISTS `ospf_ports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ospf_ports` (
  `ospf_ports_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `port_id` int NOT NULL,
  `ospfVersionNumber` enum('version2','version3') CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL DEFAULT 'version2',
  `ospf_port_id` varchar(32) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `ospfIfIpAddress` varchar(128) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `ospfAddressLessIf` int NOT NULL,
  `ospfIfAreaId` varchar(32) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `ospfIfType` varchar(32) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `ospfIfAdminStat` varchar(32) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `ospfIfRtrPriority` int DEFAULT NULL,
  `ospfIfTransitDelay` int DEFAULT NULL,
  `ospfIfRetransInterval` int DEFAULT NULL,
  `ospfIfHelloInterval` int DEFAULT NULL,
  `ospfIfRtrDeadInterval` int DEFAULT NULL,
  `ospfIfPollInterval` int DEFAULT NULL,
  `ospfIfState` varchar(32) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `ospfIfDesignatedRouter` varchar(32) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `ospfIfBackupDesignatedRouter` varchar(32) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `ospfIfEvents` int DEFAULT NULL,
  `ospfIfAuthKey` varchar(128) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `ospfIfStatus` varchar(32) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `ospfIfMulticastForwarding` varchar(32) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `ospfIfDemand` varchar(32) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `ospfIfAuthType` varchar(32) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  PRIMARY KEY (`ospf_ports_id`),
  UNIQUE KEY `device_ports` (`device_id`,`ospfVersionNumber`,`ospf_port_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `owl_cvss_metrics`
--

DROP TABLE IF EXISTS `owl_cvss_metrics`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `owl_cvss_metrics` (
  `metric` varchar(4) NOT NULL,
  `value` char(1) NOT NULL,
  `label` varchar(64) NOT NULL,
  `description` text NOT NULL,
  PRIMARY KEY (`metric`,`value`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `owl_vuln_cvss_details`
--

DROP TABLE IF EXISTS `owl_vuln_cvss_details`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `owl_vuln_cvss_details` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `vuln_result_id` bigint NOT NULL,
  `cvss_version` varchar(8) NOT NULL DEFAULT '3.1',
  `attack_vector` char(1) NOT NULL,
  `attack_complexity` char(1) NOT NULL,
  `privileges_required` char(1) NOT NULL,
  `user_interaction` char(1) NOT NULL,
  `scope` char(1) NOT NULL,
  `confidentiality` char(1) NOT NULL,
  `integrity` char(1) NOT NULL,
  `availability` char(1) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_cvss_result` (`vuln_result_id`),
  CONSTRAINT `fk_cvss_result` FOREIGN KEY (`vuln_result_id`) REFERENCES `owl_vuln_results` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=35 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `owl_vuln_jobs`
--

DROP TABLE IF EXISTS `owl_vuln_jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `owl_vuln_jobs` (
  `job_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `priority` tinyint NOT NULL DEFAULT '5',
  `status` enum('pending','running','done','parsed','error') NOT NULL DEFAULT 'pending',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT NULL,
  `scan_scope` varchar(32) NOT NULL DEFAULT 'exposure',
  `result_file` varchar(255) DEFAULT NULL,
  `pid` int DEFAULT NULL,
  `error` text,
  `log` mediumtext,
  PRIMARY KEY (`job_id`),
  KEY `idx_job_status` (`status`),
  KEY `idx_job_device` (`device_id`),
  CONSTRAINT `fk_job_device` FOREIGN KEY (`device_id`) REFERENCES `devices` (`device_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=125 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `owl_vuln_results`
--

DROP TABLE IF EXISTS `owl_vuln_results`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `owl_vuln_results` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `job_id` int NOT NULL,
  `device_id` int NOT NULL,
  `scope` varchar(32) NOT NULL,
  `template_id` varchar(255) NOT NULL,
  `template_path` varchar(255) DEFAULT NULL,
  `template_url` varchar(255) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
  `severity` enum('info','low','medium','high','critical') NOT NULL,
  `cve` varchar(64) DEFAULT NULL,
  `cwe` varchar(64) DEFAULT NULL,
  `cvss` varchar(64) DEFAULT NULL,
  `occurrences` int NOT NULL DEFAULT '1',
  `verified` tinyint(1) NOT NULL DEFAULT '0',
  `matcher_name` varchar(255) DEFAULT NULL,
  `extracted` text,
  `author` varchar(255) DEFAULT NULL,
  `tags` varchar(255) DEFAULT NULL,
  `reference` text,
  `host` varchar(255) NOT NULL,
  `matched_at` varchar(255) NOT NULL,
  `url` varchar(512) DEFAULT NULL,
  `request` mediumtext,
  `response` mediumtext,
  `ip` varchar(64) DEFAULT NULL,
  `port` int DEFAULT NULL,
  `protocol` varchar(32) DEFAULT NULL,
  `type` varchar(32) DEFAULT NULL,
  `timestamp` datetime NOT NULL,
  `raw_json` mediumtext NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_job` (`job_id`),
  KEY `idx_device` (`device_id`),
  KEY `idx_severity` (`severity`),
  KEY `idx_scope` (`scope`),
  KEY `idx_ovr_severity` (`severity`),
  KEY `idx_ovr_template` (`template_id`),
  KEY `idx_ovr_cve` (`cve`),
  KEY `idx_ovr_device` (`device_id`)
) ENGINE=InnoDB AUTO_INCREMENT=288 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `owl_vuln_scans`
--

DROP TABLE IF EXISTS `owl_vuln_scans`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `owl_vuln_scans` (
  `scan_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `started` datetime NOT NULL,
  `finished` datetime DEFAULT NULL,
  `status` enum('pending','running','done','error') NOT NULL DEFAULT 'pending',
  `engine` varchar(32) NOT NULL DEFAULT 'nuclei',
  PRIMARY KEY (`scan_id`),
  KEY `idx_device` (`device_id`),
  KEY `idx_status` (`status`),
  CONSTRAINT `fk_vuln_scan_device` FOREIGN KEY (`device_id`) REFERENCES `devices` (`device_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `owl_vuln_scopes`
--

DROP TABLE IF EXISTS `owl_vuln_scopes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `owl_vuln_scopes` (
  `scope` varchar(32) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `template_path` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`scope`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `owl_vulnerabilities`
--

DROP TABLE IF EXISTS `owl_vulnerabilities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `owl_vulnerabilities` (
  `vuln_id` int NOT NULL AUTO_INCREMENT,
  `scan_id` int NOT NULL,
  `device_id` int NOT NULL,
  `template_id` varchar(150) NOT NULL,
  `severity` enum('info','low','medium','high','critical') NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `matched_at` varchar(255) DEFAULT NULL,
  `reference` text,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`vuln_id`),
  KEY `idx_device` (`device_id`),
  KEY `idx_scan` (`scan_id`),
  KEY `idx_severity` (`severity`),
  KEY `idx_template` (`template_id`),
  CONSTRAINT `fk_vuln_device` FOREIGN KEY (`device_id`) REFERENCES `devices` (`device_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_vuln_scan` FOREIGN KEY (`scan_id`) REFERENCES `owl_vuln_scans` (`scan_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `p2p_radios`
--

DROP TABLE IF EXISTS `p2p_radios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `p2p_radios` (
  `radio_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `radio_mib` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `radio_index` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `radio_name` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `radio_standard` varchar(4) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `radio_modulation` varchar(12) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `radio_rx_level` float DEFAULT NULL,
  `radio_tx_power` float DEFAULT NULL,
  `radio_rx_freq` int DEFAULT NULL,
  `radio_tx_freq` int DEFAULT NULL,
  `radio_bandwidth` int DEFAULT NULL,
  `radio_e1t1_channels` int DEFAULT NULL,
  `radio_total_capacity` int DEFAULT NULL,
  `radio_cur_capacity` int DEFAULT NULL,
  `radio_eth_capacity` int DEFAULT NULL,
  `radio_loopback` tinyint(1) DEFAULT NULL,
  `radio_tx_mute` tinyint(1) DEFAULT NULL,
  `deleted` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`radio_id`),
  UNIQUE KEY `unique_index` (`device_id`,`radio_mib`,`radio_index`),
  KEY `count` (`deleted`,`device_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `packages`
--

DROP TABLE IF EXISTS `packages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `packages` (
  `pkg_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `name` varchar(96) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL,
  `manager` varchar(16) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL DEFAULT '1',
  `status` tinyint(1) NOT NULL,
  `version` varchar(96) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `build` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL,
  `arch` varchar(16) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL,
  `size` bigint DEFAULT NULL,
  PRIMARY KEY (`pkg_id`),
  UNIQUE KEY `unique_key` (`device_id`,`name`,`manager`,`arch`,`version`,`build`),
  KEY `device_id` (`device_id`),
  KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=1885 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pollers`
--

DROP TABLE IF EXISTS `pollers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pollers` (
  `poller_id` int NOT NULL AUTO_INCREMENT,
  `poller_name` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `device_id` int DEFAULT NULL,
  `host_id` varchar(32) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `sysName` varchar(253) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `host_uname` text CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci,
  `poller_version` varchar(32) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `poller_stats` text CHARACTER SET latin1 COLLATE latin1_general_ci,
  `timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`poller_id`),
  UNIQUE KEY `poller_name` (`poller_name`),
  KEY `host` (`host_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ports`
--

DROP TABLE IF EXISTS `ports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ports` (
  `port_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL DEFAULT '0',
  `port_64bit` tinyint(1) DEFAULT NULL,
  `port_label` varchar(128) DEFAULT NULL,
  `port_label_base` varchar(128) DEFAULT NULL,
  `port_label_num` varchar(64) DEFAULT NULL,
  `port_label_short` varchar(96) DEFAULT NULL,
  `port_descr_type` varchar(24) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `port_descr_descr` varchar(255) DEFAULT NULL,
  `port_descr_circuit` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `port_descr_speed` varchar(32) DEFAULT NULL,
  `port_descr_notes` varchar(255) DEFAULT NULL,
  `ifDescr` varchar(255) DEFAULT NULL,
  `ifName` varchar(64) DEFAULT NULL,
  `ifIndex` varchar(16) DEFAULT NULL,
  `ifSpeed` bigint DEFAULT NULL,
  `ifConnectorPresent` varchar(12) DEFAULT NULL,
  `ifPromiscuousMode` varchar(12) DEFAULT NULL,
  `ifHighSpeed` int unsigned DEFAULT NULL,
  `ifOperStatus` enum('testing','notPresent','dormant','down','lowerLayerDown','unknown','up','monitoring') CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `ifAdminStatus` enum('down','up','testing') CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `ifDuplex` varchar(12) DEFAULT NULL,
  `ifMtu` int DEFAULT NULL,
  `ifType` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `ifAlias` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `ifPhysAddress` varchar(16) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `ifLastChange` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ifVlan` varchar(16) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `ifTrunk` varchar(8) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `ifVrf` int DEFAULT NULL,
  `encrypted` tinyint(1) NOT NULL DEFAULT '0',
  `ignore` tinyint(1) NOT NULL DEFAULT '0',
  `disabled` tinyint(1) NOT NULL DEFAULT '0',
  `detailed` tinyint(1) NOT NULL DEFAULT '0',
  `deleted` tinyint(1) NOT NULL DEFAULT '0',
  `ifInUcastPkts` bigint unsigned DEFAULT NULL,
  `ifInUcastPkts_rate` bigint unsigned NOT NULL DEFAULT '0',
  `ifOutUcastPkts` bigint unsigned DEFAULT NULL,
  `ifOutUcastPkts_rate` bigint unsigned NOT NULL DEFAULT '0',
  `ifInErrors` bigint unsigned DEFAULT NULL,
  `ifInErrors_rate` float unsigned NOT NULL DEFAULT '0',
  `ifOutErrors` bigint unsigned DEFAULT NULL,
  `ifOutErrors_rate` float unsigned NOT NULL DEFAULT '0',
  `ifOctets_rate` bigint unsigned NOT NULL DEFAULT '0',
  `ifUcastPkts_rate` bigint unsigned NOT NULL DEFAULT '0',
  `ifErrors_rate` float unsigned NOT NULL DEFAULT '0',
  `ifInOctets` bigint unsigned DEFAULT NULL,
  `ifInOctets_rate` bigint unsigned NOT NULL DEFAULT '0',
  `ifOutOctets` bigint unsigned DEFAULT NULL,
  `ifOutOctets_rate` bigint unsigned NOT NULL DEFAULT '0',
  `ifInOctets_perc` tinyint unsigned NOT NULL DEFAULT '0',
  `ifOutOctets_perc` tinyint unsigned NOT NULL DEFAULT '0',
  `poll_time` int unsigned NOT NULL DEFAULT '0',
  `poll_period` int unsigned NOT NULL DEFAULT '300',
  `ifInErrors_delta` int unsigned NOT NULL DEFAULT '0',
  `ifOutErrors_delta` int unsigned NOT NULL DEFAULT '0',
  `ifInNUcastPkts` bigint unsigned DEFAULT NULL,
  `ifInNUcastPkts_rate` int unsigned NOT NULL DEFAULT '0',
  `ifOutNUcastPkts` bigint unsigned DEFAULT NULL,
  `ifOutNUcastPkts_rate` int unsigned NOT NULL DEFAULT '0',
  `ifInBroadcastPkts` bigint unsigned DEFAULT NULL,
  `ifInBroadcastPkts_rate` int unsigned NOT NULL DEFAULT '0',
  `ifOutBroadcastPkts` bigint unsigned DEFAULT NULL,
  `ifOutBroadcastPkts_rate` int unsigned NOT NULL DEFAULT '0',
  `ifInMulticastPkts` bigint unsigned DEFAULT NULL,
  `ifInMulticastPkts_rate` int unsigned NOT NULL DEFAULT '0',
  `ifOutMulticastPkts` bigint unsigned DEFAULT NULL,
  `ifOutMulticastPkts_rate` int unsigned NOT NULL DEFAULT '0',
  `port_mcbc` tinyint(1) DEFAULT NULL,
  `ifInDiscards` bigint unsigned DEFAULT NULL,
  `ifInDiscards_rate` float unsigned NOT NULL DEFAULT '0',
  `ifOutDiscards` bigint unsigned DEFAULT NULL,
  `ifOutDiscards_rate` float unsigned NOT NULL DEFAULT '0',
  `ifDiscards_rate` float unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`port_id`),
  UNIQUE KEY `device_ifIndex` (`device_id`,`ifIndex`),
  KEY `if_2` (`ifDescr`),
  KEY `port_cache` (`port_id`,`device_id`,`ignore`,`deleted`,`ifOperStatus`,`ifAdminStatus`),
  KEY `device_cache` (`device_id`,`disabled`,`deleted`),
  KEY `port_descr_type` (`port_id`,`device_id`,`port_descr_type`)
) ENGINE=InnoDB AUTO_INCREMENT=68 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ports_adsl`
--

DROP TABLE IF EXISTS `ports_adsl`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ports_adsl` (
  `adsl_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL DEFAULT '0',
  `port_id` int NOT NULL,
  `port_adsl_updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `adslLineCoding` varchar(8) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL,
  `adslLineType` varchar(16) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL,
  `adslAtucInvVendorID` varchar(8) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL,
  `adslAtucInvVersionNumber` varchar(8) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL,
  `adslAtucCurrSnrMgn` decimal(5,1) NOT NULL,
  `adslAtucCurrAtn` decimal(5,1) NOT NULL,
  `adslAtucCurrOutputPwr` decimal(5,1) NOT NULL,
  `adslAtucCurrAttainableRate` int NOT NULL,
  `adslAtucChanCurrTxRate` int NOT NULL,
  `adslAturInvSerialNumber` varchar(8) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL,
  `adslAturInvVendorID` varchar(8) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL,
  `adslAturInvVersionNumber` varchar(8) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL,
  `adslAturChanCurrTxRate` int NOT NULL,
  `adslAturCurrSnrMgn` decimal(5,1) NOT NULL,
  `adslAturCurrAtn` decimal(5,1) NOT NULL,
  `adslAturCurrOutputPwr` decimal(5,1) NOT NULL,
  `adslAturCurrAttainableRate` int NOT NULL,
  PRIMARY KEY (`adsl_id`),
  KEY `cache` (`device_id`,`port_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ports_cbqos`
--

DROP TABLE IF EXISTS `ports_cbqos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ports_cbqos` (
  `cbqos_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `port_id` int NOT NULL,
  `direction` varchar(16) NOT NULL,
  `PrePolicyPkt` bigint NOT NULL,
  `PrePolicyPkt_rate` int NOT NULL,
  `PrePolicyByte` bigint NOT NULL,
  `PrePolicyByte_rate` int NOT NULL,
  `PostPolicyByte` bigint NOT NULL,
  `PostPolicyByte_rate` int NOT NULL,
  `DropPkt` bigint NOT NULL,
  `DropPkt_rate` int NOT NULL,
  `DropByte` bigint NOT NULL,
  `DropByte_rate` int NOT NULL,
  `NoBufDropPkt` bigint NOT NULL,
  `NoBufDropPkt_rate` int NOT NULL,
  `cbqos_lastpolled` int NOT NULL,
  `policy_index` int unsigned NOT NULL,
  `object_index` int unsigned NOT NULL,
  `policy_name` varchar(64) NOT NULL,
  `object_name` varchar(64) NOT NULL,
  PRIMARY KEY (`cbqos_id`),
  UNIQUE KEY `device_id` (`device_id`,`port_id`,`policy_index`,`object_index`),
  KEY `port_id` (`port_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ports_stack`
--

DROP TABLE IF EXISTS `ports_stack`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ports_stack` (
  `port_stack_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `port_id_high` int NOT NULL,
  `port_id_low` int NOT NULL,
  `ifStackStatus` varchar(16) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  PRIMARY KEY (`port_stack_id`),
  KEY `cache_stack` (`device_id`,`port_id_high`,`port_id_low`,`ifStackStatus`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ports_vlans`
--

DROP TABLE IF EXISTS `ports_vlans`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ports_vlans` (
  `port_vlan_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `port_id` int NOT NULL,
  `vlan` int NOT NULL,
  `baseport` int NOT NULL,
  `priority` bigint NOT NULL,
  `state` varchar(16) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `cost` int NOT NULL,
  PRIMARY KEY (`port_vlan_id`),
  UNIQUE KEY `unique` (`device_id`,`port_id`,`vlan`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `printersupplies`
--

DROP TABLE IF EXISTS `printersupplies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `printersupplies` (
  `supply_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL DEFAULT '0',
  `supply_type` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `supply_index` varchar(128) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `supply_mib` varchar(64) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `supply_oid` varchar(64) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `supply_descr` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `supply_colour` varchar(10) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `supply_capacity` int NOT NULL,
  `supply_value` int NOT NULL,
  `supply_capacity_oid` varchar(64) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  PRIMARY KEY (`supply_id`),
  KEY `device_id` (`device_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `probes`
--

DROP TABLE IF EXISTS `probes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `probes` (
  `probe_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `probe_descr` varchar(64) COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `probe_type` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `probe_param` text CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci,
  `probe_args` varchar(256) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `probe_no_default` tinyint(1) NOT NULL DEFAULT '0',
  `probe_disabled` tinyint(1) NOT NULL DEFAULT '0',
  `probe_reset` tinyint(1) NOT NULL DEFAULT '0',
  `probe_status` enum('ok','warning','alert','unknown') CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL DEFAULT 'unknown',
  `probe_msg` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `probe_output` text CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci,
  `probe_changed` timestamp NULL DEFAULT NULL,
  `probe_checked` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`probe_id`),
  KEY `device_id` (`device_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `processors`
--

DROP TABLE IF EXISTS `processors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `processors` (
  `processor_id` int NOT NULL AUTO_INCREMENT,
  `entPhysicalIndex` int DEFAULT NULL,
  `hrDeviceIndex` int DEFAULT NULL,
  `device_id` int NOT NULL,
  `processor_mib` varchar(64) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `processor_object` varchar(64) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `processor_oid` varchar(128) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `processor_index` varchar(128) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `processor_type` varchar(128) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `processor_descr` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `processor_returns_idle` tinyint(1) NOT NULL DEFAULT '0',
  `processor_precision` int NOT NULL DEFAULT '1',
  `processor_warn_limit` int DEFAULT NULL,
  `processor_warn_count` int DEFAULT NULL,
  `processor_crit_limit` int DEFAULT NULL,
  `processor_crit_count` int DEFAULT NULL,
  `processor_usage` int NOT NULL,
  `processor_polled` int NOT NULL,
  `processor_ignore` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`processor_id`),
  KEY `device_id` (`device_id`)
) ENGINE=InnoDB AUTO_INCREMENT=229 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pseudowires`
--

DROP TABLE IF EXISTS `pseudowires`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pseudowires` (
  `pseudowire_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `mib` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL DEFAULT 'CISCO-IETF-PW-MIB',
  `pwIndex` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `pwID` int NOT NULL,
  `pwOutboundLabel` int unsigned NOT NULL,
  `pwInboundLabel` int unsigned NOT NULL,
  `port_id` int NOT NULL,
  `peer_device_id` int DEFAULT NULL,
  `peer_addr` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `peer_rdns` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL DEFAULT '',
  `pwType` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `pwPsnType` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `pwLocalIfMtu` int unsigned DEFAULT NULL,
  `pwRemoteIfMtu` int unsigned DEFAULT NULL,
  `pwDescr` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `pwRemoteIfString` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `pwRowStatus` varchar(16) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '',
  `pwOperStatus` varchar(16) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `pwLocalStatus` varchar(16) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `pwRemoteStatus` varchar(16) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `pwUptime` int unsigned NOT NULL,
  `event` enum('ok','warning','alert','ignore') CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `last_change` int unsigned NOT NULL,
  PRIMARY KEY (`pseudowire_id`),
  KEY `port_id` (`port_id`),
  KEY `device_id` (`device_id`),
  KEY `row_status` (`device_id`,`pwRowStatus`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `role_id` int NOT NULL AUTO_INCREMENT,
  `role_name` varchar(32) NOT NULL,
  `role_descr` varchar(128) NOT NULL,
  PRIMARY KEY (`role_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `roles_entity_permissions`
--

DROP TABLE IF EXISTS `roles_entity_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles_entity_permissions` (
  `perm_id` int NOT NULL AUTO_INCREMENT,
  `role_id` bigint NOT NULL,
  `entity_type` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `entity_id` int NOT NULL,
  `access` enum('ro','rw') CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL DEFAULT 'ro',
  PRIMARY KEY (`perm_id`),
  KEY `user_id` (`role_id`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `roles_permissions`
--

DROP TABLE IF EXISTS `roles_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles_permissions` (
  `role_perm_id` int NOT NULL AUTO_INCREMENT,
  `role_id` int NOT NULL,
  `permission` varchar(32) NOT NULL,
  PRIMARY KEY (`role_perm_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `roles_users`
--

DROP TABLE IF EXISTS `roles_users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles_users` (
  `role_user_id` int NOT NULL AUTO_INCREMENT,
  `role_id` int NOT NULL,
  `user_id` bigint NOT NULL,
  `auth_mechanism` varchar(11) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  PRIMARY KEY (`role_user_id`),
  UNIQUE KEY `group_user` (`role_id`,`user_id`),
  UNIQUE KEY `user_auth` (`user_id`,`auth_mechanism`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `sensors`
--

DROP TABLE IF EXISTS `sensors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sensors` (
  `sensor_id` int NOT NULL AUTO_INCREMENT,
  `sensor_deleted` tinyint(1) NOT NULL DEFAULT '0',
  `sensor_class` varchar(64) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `device_id` int NOT NULL DEFAULT '0',
  `poller_type` enum('snmp','agent','ipmi') CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL DEFAULT 'snmp',
  `sensor_oid` varchar(255) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `sensor_mib` varchar(64) CHARACTER SET latin1 COLLATE latin1_general_cs DEFAULT NULL,
  `sensor_object` varchar(64) CHARACTER SET latin1 COLLATE latin1_general_cs DEFAULT NULL,
  `sensor_index` varchar(128) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `sensor_type` varchar(255) CHARACTER SET latin1 COLLATE latin1_general_cs DEFAULT NULL,
  `sensor_descr` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `sensor_unit` varchar(16) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `sensor_multiplier` float NOT NULL DEFAULT '1',
  `sensor_limit` float DEFAULT NULL,
  `sensor_limit_warn` float DEFAULT NULL,
  `sensor_limit_low` float DEFAULT NULL,
  `sensor_limit_low_warn` float DEFAULT NULL,
  `sensor_custom_limit` tinyint(1) NOT NULL DEFAULT '0',
  `entPhysicalIndex_measured` varchar(16) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `measured_class` varchar(16) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `measured_entity` int unsigned DEFAULT NULL,
  `measured_entity_label` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `entPhysicalIndex` varchar(16) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `entPhysicalClass` varchar(32) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `sensor_ignore` tinyint(1) NOT NULL DEFAULT '0',
  `sensor_disable` tinyint(1) NOT NULL DEFAULT '0',
  `sensor_value` double(32,16) DEFAULT NULL,
  `sensor_event` enum('ok','warning','alert','ignore') CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL DEFAULT 'ignore',
  `sensor_status` varchar(64) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `sensor_polled` int DEFAULT NULL,
  `sensor_last_change` int DEFAULT NULL,
  PRIMARY KEY (`sensor_id`),
  KEY `sensor_host` (`device_id`),
  KEY `sensor_class` (`sensor_class`),
  KEY `sensor_type` (`sensor_type`),
  KEY `sensor_cache` (`sensor_id`,`device_id`,`sensor_class`,`sensor_type`,`sensor_ignore`,`sensor_disable`),
  KEY `sensor_oid` (`sensor_oid`)
) ENGINE=InnoDB AUTO_INCREMENT=56 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `services`
--

DROP TABLE IF EXISTS `services`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `services` (
  `service_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `service_ip` text CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `service_type` varchar(16) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `service_desc` text CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `service_param` text CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `service_ignore` tinyint(1) NOT NULL,
  `service_status` tinyint NOT NULL DEFAULT '0',
  `service_checked` int NOT NULL DEFAULT '0',
  `service_changed` int NOT NULL DEFAULT '0',
  `service_message` text CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `service_disabled` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`service_id`),
  KEY `service_host` (`device_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `slas`
--

DROP TABLE IF EXISTS `slas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `slas` (
  `sla_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `sla_mib` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT 'cisco-rttmon-mib',
  `sla_index` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `sla_owner` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `sla_tag` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `sla_target` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `sla_status` varchar(16) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `sla_limit_high` int NOT NULL DEFAULT '5000',
  `sla_limit_high_warn` int NOT NULL DEFAULT '625',
  `sla_graph` enum('echo','jitter') CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `rtt_type` varchar(16) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `deleted` tinyint(1) NOT NULL DEFAULT '0',
  `rtt_value` decimal(11,2) NOT NULL,
  `rtt_sense` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `rtt_event` enum('ok','warning','alert','ignore') CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `rtt_unixtime` int NOT NULL,
  `rtt_last_change` int NOT NULL,
  `rtt_minimum` decimal(11,2) DEFAULT NULL,
  `rtt_maximum` decimal(11,2) DEFAULT NULL,
  `rtt_stddev` decimal(11,3) DEFAULT NULL,
  `rtt_success` int DEFAULT NULL,
  `rtt_loss` int DEFAULT NULL,
  PRIMARY KEY (`sla_id`),
  UNIQUE KEY `unique_key` (`device_id`,`sla_mib`(50),`sla_index`(50),`sla_owner`(50)),
  KEY `device_id` (`device_id`),
  KEY `count` (`deleted`,`device_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `snmp_errors`
--

DROP TABLE IF EXISTS `snmp_errors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `snmp_errors` (
  `error_id` int unsigned NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `error_count` int unsigned NOT NULL DEFAULT '0',
  `error_code` int NOT NULL,
  `error_reason` varchar(16) NOT NULL DEFAULT '',
  `snmp_cmd_exitcode` tinyint unsigned NOT NULL,
  `snmp_cmd` enum('snmpget','snmpwalk','snmpgetnext') CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL COMMENT 'Latin charset for 1byte chars!',
  `snmp_options` varchar(16) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL COMMENT 'Latin charset for 1byte chars!',
  `mib_dir` varchar(256) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL COMMENT 'Latin charset for 1byte chars!',
  `mib` varchar(128) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL COMMENT 'Latin charset for 1byte chars!',
  `oid` text CHARACTER SET latin1 COLLATE latin1_general_ci COMMENT 'Latin charset for 1byte chars!',
  `added` int unsigned NOT NULL,
  `updated` int unsigned NOT NULL,
  PRIMARY KEY (`error_id`),
  UNIQUE KEY `error_index` (`device_id`,`error_code`,`snmp_cmd`,`mib`,`oid`(512)) USING BTREE,
  CONSTRAINT `snmp_devices` FOREIGN KEY (`device_id`) REFERENCES `devices` (`device_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=107 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `status`
--

DROP TABLE IF EXISTS `status`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `status` (
  `status_id` int NOT NULL AUTO_INCREMENT,
  `status_deleted` tinyint(1) NOT NULL DEFAULT '0',
  `device_id` int NOT NULL DEFAULT '0',
  `poller_type` enum('snmp','agent','ipmi') CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL DEFAULT 'snmp',
  `status_oid` varchar(255) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `status_mib` varchar(64) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `status_object` varchar(64) CHARACTER SET latin1 COLLATE latin1_general_cs DEFAULT NULL,
  `status_index` varchar(128) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `status_type` varchar(255) CHARACTER SET latin1 COLLATE latin1_general_cs DEFAULT NULL,
  `status_descr` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `entPhysicalIndex` varchar(16) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `entPhysicalClass` varchar(32) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `entPhysicalIndex_measured` varchar(16) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `measured_class` varchar(16) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `measured_entity` int unsigned DEFAULT NULL,
  `measured_entity_label` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `status_ignore` tinyint(1) NOT NULL DEFAULT '0',
  `status_disable` tinyint(1) NOT NULL DEFAULT '0',
  `status_value` int DEFAULT NULL,
  `status_polled` int NOT NULL,
  `status_last_change` int NOT NULL,
  `status_event` enum('ok','warning','alert','ignore') CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL DEFAULT 'ignore',
  `status_map` varchar(64) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `status_name` varchar(64) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  PRIMARY KEY (`status_id`),
  KEY `sensor_host` (`device_id`),
  KEY `sensor_type` (`status_type`),
  KEY `status_cache` (`status_id`,`device_id`,`entPhysicalClass`,`status_ignore`,`status_disable`),
  KEY `status_oid` (`status_oid`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `storage`
--

DROP TABLE IF EXISTS `storage`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `storage` (
  `storage_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `storage_mib` varchar(64) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `storage_object` varchar(64) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `storage_index` varchar(128) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `storage_type` varchar(32) CHARACTER SET latin1 COLLATE latin1_general_cs DEFAULT NULL,
  `storage_descr` text CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `storage_hc` tinyint(1) NOT NULL DEFAULT '0',
  `storage_deleted` tinyint(1) NOT NULL DEFAULT '0',
  `storage_warn_limit` int DEFAULT '0',
  `storage_crit_limit` int DEFAULT '0',
  `storage_ignore` tinyint(1) NOT NULL DEFAULT '0',
  `storage_polled` int NOT NULL,
  `storage_size` bigint NOT NULL,
  `storage_units` int NOT NULL,
  `storage_used` bigint NOT NULL,
  `storage_free` bigint NOT NULL,
  `storage_perc` int NOT NULL,
  PRIMARY KEY (`storage_id`),
  UNIQUE KEY `index_unique` (`device_id`,`storage_mib`,`storage_index`),
  KEY `device_id` (`device_id`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `syslog`
--

DROP TABLE IF EXISTS `syslog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `syslog` (
  `device_id` int DEFAULT NULL,
  `host` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL COMMENT 'Hostname or IP received by syslog server',
  `facility` varchar(10) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `priority` tinyint NOT NULL DEFAULT '8',
  `level` tinyint NOT NULL DEFAULT '8',
  `tag` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `program` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `msg` text CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci,
  `seq` bigint unsigned NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (`seq`),
  KEY `datetime` (`timestamp`),
  KEY `device_id` (`device_id`),
  KEY `program` (`program`),
  KEY `priority` (`priority`),
  KEY `device_priority` (`device_id`,`priority`),
  KEY `device_program` (`device_id`,`program`),
  KEY `device_timestamp` (`device_id`,`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `syslog_alerts`
--

DROP TABLE IF EXISTS `syslog_alerts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `syslog_alerts` (
  `lal_id` int NOT NULL AUTO_INCREMENT,
  `timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `device_id` int NOT NULL,
  `la_id` int NOT NULL,
  `syslog_id` bigint NOT NULL,
  `message` text CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `program` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `sev` tinyint NOT NULL DEFAULT '1',
  `ack` tinyint(1) NOT NULL DEFAULT '0',
  `notified` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`lal_id`),
  KEY `device_id` (`device_id`),
  KEY `la_id` (`la_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `syslog_rules`
--

DROP TABLE IF EXISTS `syslog_rules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `syslog_rules` (
  `la_id` int NOT NULL AUTO_INCREMENT,
  `la_name` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `la_descr` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `la_rule` text CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci,
  `la_severity` int NOT NULL DEFAULT '8',
  `la_disable` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`la_id`),
  KEY `la_cache` (`la_disable`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `syslog_rules_assoc`
--

DROP TABLE IF EXISTS `syslog_rules_assoc`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `syslog_rules_assoc` (
  `laa_id` int NOT NULL AUTO_INCREMENT,
  `la_id` int NOT NULL,
  `entity_type` varchar(16) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `entity_id` int NOT NULL,
  PRIMARY KEY (`laa_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ucd_diskio`
--

DROP TABLE IF EXISTS `ucd_diskio`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ucd_diskio` (
  `diskio_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `diskio_index` int NOT NULL,
  `diskio_descr` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `diskIONReadX` int NOT NULL,
  `diskIONReadX_rate` int NOT NULL,
  `diskIONWrittenX` int NOT NULL,
  `diskIONWrittenX_rate` int NOT NULL,
  `diskIOReads` int NOT NULL,
  `diskIOReads_rate` int NOT NULL,
  `diskIOWrites` int NOT NULL,
  `diskIOWrites_rate` int NOT NULL,
  `diskio_polled` int NOT NULL,
  PRIMARY KEY (`diskio_id`),
  KEY `device_id` (`device_id`)
) ENGINE=InnoDB AUTO_INCREMENT=61 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `user_id` bigint NOT NULL AUTO_INCREMENT,
  `username` varchar(72) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `password` varchar(255) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `realname` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `email` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `descr` text CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `level` tinyint NOT NULL DEFAULT '0',
  `can_modify_passwd` tinyint NOT NULL DEFAULT '1',
  `user_options` text CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci,
  `type` varchar(16) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL DEFAULT 'mysql',
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `username` (`username`,`type`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users_ckeys`
--

DROP TABLE IF EXISTS `users_ckeys`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users_ckeys` (
  `user_ckey_id` int NOT NULL AUTO_INCREMENT,
  `user_encpass` text CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `expire` int NOT NULL,
  `username` varchar(30) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `user_uniq` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `user_ckey` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  PRIMARY KEY (`user_ckey_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users_prefs`
--

DROP TABLE IF EXISTS `users_prefs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users_prefs` (
  `pref_id` int NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `pref` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `value` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`pref_id`),
  UNIQUE KEY `user_id.pref` (`user_id`,`pref`),
  KEY `pref` (`pref`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `vlans`
--

DROP TABLE IF EXISTS `vlans`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vlans` (
  `vlan_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int DEFAULT NULL,
  `ifIndex` int DEFAULT NULL,
  `vlan_vlan` int DEFAULT NULL,
  `vlan_domain` int DEFAULT NULL,
  `vlan_name` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `vlan_type` varchar(16) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `vlan_mtu` int DEFAULT NULL,
  `vlan_status` varchar(16) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `vlan_context` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`vlan_id`),
  KEY `device_id` (`device_id`,`vlan_vlan`),
  KEY `ifIndex` (`ifIndex`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `vlans_fdb`
--

DROP TABLE IF EXISTS `vlans_fdb`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vlans_fdb` (
  `fdb_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `vlan_id` int NOT NULL,
  `port_id` int DEFAULT NULL,
  `mac_address` varchar(32) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `fdb_status` varchar(32) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `fdb_port` varchar(32) COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `fdb_last_change` int unsigned DEFAULT NULL,
  `deleted` tinyint NOT NULL DEFAULT '0',
  PRIMARY KEY (`fdb_id`),
  KEY `port_id` (`port_id`),
  KEY `fdb_cache` (`device_id`,`vlan_id`,`mac_address`,`port_id`,`deleted`) USING BTREE,
  KEY `device` (`device_id`,`deleted`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `vminfo`
--

DROP TABLE IF EXISTS `vminfo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vminfo` (
  `vm_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `vm_type` varchar(16) NOT NULL DEFAULT 'vmware',
  `vm_name` varchar(128) DEFAULT NULL,
  `vm_guestos` varchar(128) DEFAULT NULL,
  `vm_memory` int DEFAULT NULL,
  `vm_cpucount` int DEFAULT NULL,
  `vm_state` varchar(128) DEFAULT NULL,
  `vm_uuid` varchar(64) DEFAULT NULL,
  `vm_source` varchar(32) DEFAULT NULL,
  PRIMARY KEY (`vm_id`),
  KEY `device_id` (`device_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `vrfs`
--

DROP TABLE IF EXISTS `vrfs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vrfs` (
  `vrf_id` int NOT NULL AUTO_INCREMENT,
  `vrf_mib` varchar(64) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `vrf_name` varchar(128) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `vrf_rd` varchar(128) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `vrf_descr` text CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci,
  `device_id` int NOT NULL,
  `vrf_admin_status` enum('up','down','testing') CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL DEFAULT 'up',
  `vrf_oper_status` enum('up','down') CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL DEFAULT 'up',
  `vrf_active_ports` int unsigned NOT NULL DEFAULT '0',
  `vrf_total_ports` int unsigned NOT NULL DEFAULT '0',
  `vrf_added_routes` int unsigned NOT NULL DEFAULT '0',
  `vrf_deleted_routes` int unsigned NOT NULL DEFAULT '0',
  `vrf_total_routes` int unsigned NOT NULL DEFAULT '0',
  `vrf_added` int unsigned DEFAULT NULL,
  `vrf_last_change` int unsigned DEFAULT NULL,
  PRIMARY KEY (`vrf_id`),
  KEY `device_id` (`device_id`),
  KEY `vrf_cache` (`vrf_id`,`device_id`,`vrf_rd`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `weathermaps`
--

DROP TABLE IF EXISTS `weathermaps`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `weathermaps` (
  `wmap_id` int NOT NULL AUTO_INCREMENT,
  `wmap_name` varchar(32) NOT NULL,
  `wmap_descr` varchar(128) DEFAULT NULL,
  `wmap_conf` mediumtext NOT NULL,
  PRIMARY KEY (`wmap_id`),
  UNIQUE KEY `wmap_name` (`wmap_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `wifi_accesspoints`
--

DROP TABLE IF EXISTS `wifi_accesspoints`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `wifi_accesspoints` (
  `wifi_accesspoint_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `ap_number` int DEFAULT NULL,
  `name` varchar(45) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `serial` varchar(45) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `model` varchar(45) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `location` varchar(45) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `fingerprint` varchar(45) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `delete` tinyint DEFAULT NULL,
  PRIMARY KEY (`wifi_accesspoint_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `wifi_aps`
--

DROP TABLE IF EXISTS `wifi_aps`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `wifi_aps` (
  `wifi_ap_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `ap_mib` varchar(128) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `ap_index` varchar(32) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `ap_number` int DEFAULT NULL,
  `ap_address` varchar(128) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `ap_name` varchar(45) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `ap_serial` varchar(45) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `ap_model` varchar(45) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `ap_location` varchar(45) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `ap_fingerprint` varchar(45) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `ap_status` varchar(8) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `ap_admin_status` varchar(45) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `ap_uptime` int NOT NULL,
  `ap_control_uptime` int NOT NULL,
  `ap_control_latency` int NOT NULL,
  `deleted` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`wifi_ap_id`),
  KEY `device_id` (`device_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `wifi_aps_members`
--

DROP TABLE IF EXISTS `wifi_aps_members`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `wifi_aps_members` (
  `wifi_ap_member_id` int NOT NULL AUTO_INCREMENT,
  `wifi_ap_id` int NOT NULL,
  `device_id` int NOT NULL,
  `ap_index_member` varchar(32) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `ap_name` varchar(45) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `ap_member_state` varchar(8) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `ap_member_admin_state` varchar(45) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `ap_member_conns` int DEFAULT NULL,
  `ap_member_channel` int DEFAULT NULL,
  `ap_member_radiotype` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`wifi_ap_member_id`),
  KEY `device_id` (`device_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `wifi_radios`
--

DROP TABLE IF EXISTS `wifi_radios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `wifi_radios` (
  `wifi_radio_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `radio_mib` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `radio_number` int NOT NULL,
  `radio_type` varchar(45) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `radio_protection` varchar(8) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT 'none',
  `radio_bsstype` varchar(16) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `radio_status` varchar(45) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `radio_ap` int DEFAULT NULL,
  `radio_clients` int DEFAULT NULL,
  `radio_txpower` varchar(8) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `radio_channel` int DEFAULT NULL,
  `radio_util` int DEFAULT NULL,
  `radio_mac` varchar(45) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `radio_assoc_clients` int DEFAULT NULL,
  `radio_mon_clients` int DEFAULT NULL,
  `radio_ht_mode` varchar(4) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `radio_ht_extchan` varchar(8) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `radio_ht_chan` varchar(4) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`wifi_radio_id`),
  UNIQUE KEY `unique_dev_ap_number` (`device_id`,`radio_ap`,`radio_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `wifi_sessions`
--

DROP TABLE IF EXISTS `wifi_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `wifi_sessions` (
  `wifi_session_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int DEFAULT NULL,
  `mac_addr` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `session_id` varchar(45) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `username` varchar(45) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `ipv4_addr` varchar(45) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `ssid` varchar(45) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `state` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `timestamp` timestamp NULL DEFAULT NULL,
  `radio_id` int DEFAULT NULL,
  `uptime` int DEFAULT NULL,
  PRIMARY KEY (`wifi_session_id`),
  KEY `device_id` (`device_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `wifi_stations`
--

DROP TABLE IF EXISTS `wifi_stations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `wifi_stations` (
  `wifi_station_id` int NOT NULL AUTO_INCREMENT,
  `rx_bytes` int NOT NULL,
  `uptime` int NOT NULL,
  `ap_mac` varchar(16) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `assoc_time` int NOT NULL,
  `auth_time` int NOT NULL,
  `authorized` int NOT NULL,
  `bssid` varchar(16) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `bytes` int NOT NULL,
  `ccq` int NOT NULL,
  `dhcpend_time` int NOT NULL,
  `dhcpstart_time` int NOT NULL,
  `essid` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `first_seen` int NOT NULL,
  `hostname` int NOT NULL,
  `idletime` int NOT NULL,
  `ip` int NOT NULL,
  `is_guest` int NOT NULL,
  `noise` int NOT NULL,
  `oui` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `powersave` int NOT NULL,
  `qos_policy_applied` int NOT NULL,
  `radio` varchar(8) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `rssi` int NOT NULL,
  `rx_crypts` int NOT NULL,
  `rx_dropped` int NOT NULL,
  `rx_errors` int NOT NULL,
  `rx_frags` int NOT NULL,
  `rx_mcast` int NOT NULL,
  `rx_packets` int NOT NULL,
  `rx_rate` int NOT NULL,
  `rx_retries` int NOT NULL,
  `signal` int NOT NULL,
  `site_id` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `state` int NOT NULL,
  `state_ht` int NOT NULL,
  `tx_bytes` int NOT NULL,
  `tx_dropped` int NOT NULL,
  `tx_errors` int NOT NULL,
  `tx_packets` int NOT NULL,
  `tx_power` int NOT NULL,
  `tx_rate` int NOT NULL,
  `tx_retries` int NOT NULL,
  `user_id` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  PRIMARY KEY (`wifi_station_id`),
  UNIQUE KEY `wifi_station_id` (`wifi_station_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `wifi_wlans`
--

DROP TABLE IF EXISTS `wifi_wlans`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `wifi_wlans` (
  `wlan_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `wlan_index` int NOT NULL,
  `wlan_name` varchar(128) DEFAULT NULL,
  `wlan_admin_status` tinyint(1) DEFAULT '1',
  `wlan_ssid` varchar(64) DEFAULT NULL,
  `wlan_ssid_bcast` tinyint(1) DEFAULT NULL,
  `wlan_bssid` varchar(64) DEFAULT NULL,
  `wlan_bss_type` varchar(32) DEFAULT NULL,
  `wlan_channel` int DEFAULT NULL,
  `wlan_dtim_period` int DEFAULT NULL,
  `wlan_beacon_period` int DEFAULT NULL,
  `wlan_frag_thresh` int DEFAULT NULL,
  `wlan_igmp_snoop` tinyint(1) DEFAULT NULL,
  `wlan_prot_mode` varchar(32) DEFAULT NULL,
  `wlan_radio_mode` varchar(32) DEFAULT NULL,
  `wlan_rts_thresh` int DEFAULT NULL,
  `wlan_vlan_id` int DEFAULT NULL,
  PRIMARY KEY (`wlan_id`),
  KEY `device_id` (`device_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `winservices`
--

DROP TABLE IF EXISTS `winservices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `winservices` (
  `winsvc_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `name` varchar(96) NOT NULL,
  `displayname` varchar(96) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `state` varchar(40) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `startmode` varchar(40) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  PRIMARY KEY (`winsvc_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping routines for database 'observium'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-04-08 11:19:19
